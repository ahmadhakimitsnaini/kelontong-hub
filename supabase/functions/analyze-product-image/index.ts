import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

// Interface untuk data produk
interface Product {
  id: string
  nama: string
  kategori: string
  harga_jual: number
}

// Handler utama Edge Function
Deno.serve(async (req) => {
  // 1. Handle CORS (Preflight request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY tidak dikonfigurasi di secrets.')
    }

    // 2. Ambil payload dari frontend
    const { image, catalog } = await req.json()

    if (!image || !catalog) {
      return new Response(JSON.stringify({ error: 'Image dan catalog wajib disertakan.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Bersihkan prefix base64 ("data:image/jpeg;base64,")
    const base64Data = image.replace(/^data:image\/(png|jpeg|webp);base64,/, '')

    // 3. Susun Prompt Hibrida (Context-Aware)
    const prompt = `
Anda adalah AI Kasir Pintar. Tugas Anda adalah mengidentifikasi produk fisik dari foto yang diberikan, lalu MENCARI produk yang paling cocok dari KATALOG TOKO berikut.

KATALOG TOKO (JSON Array):
${JSON.stringify(catalog)}

INSTRUKSI:
1. Analisa gambar produk dengan teliti (merek, varian, ukuran, warna).
2. Cari maksimal 3 produk dari KATALOG TOKO yang paling cocok dengan gambar.
3. WAJIB mengembalikan respon HANYA dalam format JSON array yang berisi objek produk persis seperti di katalog (id, nama, kategori, harga_jual).
4. Jika tidak ada yang cocok sama sekali dari katalog, kembalikan array kosong [].
5. Urutkan dari yang paling akurat (confidence tertinggi).

FORMAT RESPON JSON YANG DIHARAPKAN:
[
  { "id": "1", "nama": "Indomie Goreng", "kategori": "Makanan", "harga_jual": 3000 }
]
`

    // 4. Panggil Gemini Flash API via REST
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`
    
    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.1 // Suhu rendah agar akurat dan tidak berhalusinasi
      }
    }

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiBody)
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error("Gemini API Error:", errText)
      throw new Error(`Gagal memanggil Gemini API: ${errText}`)
    }

    const geminiData = await geminiResponse.json()
    
    // 5. Parse Hasil dari JSON Gemini
    const textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]"
    let results = []
    
    try {
      results = JSON.parse(textResult)
    } catch (parseError) {
      console.error("Gagal parse JSON dari Gemini:", textResult)
      results = []
    }

    // 6. Kembalikan ke Frontend
    return new Response(
      JSON.stringify({ results }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('[analyze-product-image] Error:', error.message)
    // RETURN 200 AGAR FRONTEND BISA MEMBACA ISI ERROR JSON (TIDAK DITUTUPI OLEH SUPABASE)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  }
})

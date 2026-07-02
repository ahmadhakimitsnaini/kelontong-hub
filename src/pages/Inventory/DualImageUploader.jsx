import React, { useRef } from 'react';
import { Plus, X, Image as ImageIcon } from 'lucide-react';

const DualImageUploader = ({ images, onChange }) => {
  const fileInputRef = useRef(null);
  const activeSlotRef = useRef(null);

  // Ensure images array always has at least 2 slots (can be undefined/null)
  const normalizedImages = [images[0] || null, images[1] || null];

  const handleBoxClick = (index) => {
    activeSlotRef.current = index;
    fileInputRef.current.click();
  };

  const processFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const compressedImage = await processFile(file);
      const newImages = [...normalizedImages];
      newImages[activeSlotRef.current] = compressedImage;
      onChange(newImages);
    } catch (error) {
      console.error("Error processing image:", error);
    }
    
    // Reset file input so selecting the same file again triggers onChange
    e.target.value = '';
  };

  const removeImage = (index, e) => {
    e.stopPropagation();
    const newImages = [...normalizedImages];
    newImages[index] = null; 
    onChange(newImages);
  };

  const renderSlot = (index, label) => {
    const imageSrc = normalizedImages[index];
    
    return (
      <div 
        onClick={() => handleBoxClick(index)}
        className="relative flex flex-col items-center justify-center w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 hover:border-primary-400 transition-colors overflow-hidden group"
      >
        {imageSrc ? (
          <>
            <img src={imageSrc} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">Ubah Foto</span>
            </div>
            <button
              type="button"
              onClick={(e) => removeImage(index, e)}
              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-gray-700 hover:text-red-500 rounded-full shadow-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-primary-500">
            <div className="p-2 bg-white rounded-full shadow-sm">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">{label}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/jpeg, image/png, image/webp" 
        className="hidden" 
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-1">
           {renderSlot(0, "Foto Utama")}
        </div>
        <div className="col-span-1">
           {renderSlot(1, "Foto 2")}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5" />
        Format JPG, PNG, WEBP (Max. 5MB)
      </p>
    </div>
  );
};

export default DualImageUploader;

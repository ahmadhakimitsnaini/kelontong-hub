import { create } from 'zustand'
import db from '../db/db'

const useSettingsStore = create((set, get) => ({
  isNightPricingActive: false,
  nightStartTime: '00:00',
  nightEndTime: '06:00',
  isLoading: true,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const activeSetting = await db.settings.get('is_night_pricing_active');
      const startSetting = await db.settings.get('night_start_time');
      const endSetting = await db.settings.get('night_end_time');

      set({
        isNightPricingActive: activeSetting ? activeSetting.value === 'true' : false,
        nightStartTime: startSetting ? startSetting.value : '00:00',
        nightEndTime: endSetting ? endSetting.value : '06:00',
        isLoading: false
      });
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      set({ isLoading: false });
    }
  },

  updateNightSettings: async (isActive, start, end) => {
    try {
      await db.settings.put({ key: 'is_night_pricing_active', value: isActive ? 'true' : 'false' });
      await db.settings.put({ key: 'night_start_time', value: start });
      await db.settings.put({ key: 'night_end_time', value: end });

      set({
        isNightPricingActive: isActive,
        nightStartTime: start,
        nightEndTime: end
      });
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  }
}));

export default useSettingsStore;

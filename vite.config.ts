import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        catalog: 'index.html',
        characterCorridor: 'games/character-corridor/index.html',
        findAllAnagrams: 'games/find-all-anagrams/index.html',
        minimumWindow: 'games/minimum-window/index.html',
        rainline: 'games/rainline/index.html',
        subarraySumK: 'games/subarray-sum-k/index.html',
        zeroWarehouse: 'games/zero-warehouse/index.html',
      },
    },
  },
})

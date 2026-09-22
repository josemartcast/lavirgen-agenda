/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arena:    '#EDE6DD',
        blanco:   '#FFFFFF',
        terracota:{ DEFAULT: '#A0614A', suave: '#C98F7A', claro: '#E8C4B2', hover: '#8A5040' },
        salvia:   { DEFAULT: '#8C9F7D', claro: '#C8D8C0' },
        madera:   '#A67C52',
        carbon:   '#2E2E2A',
        gris:     '#9A9A9A',
        'rosa-palido': '#F2DADA',
        border: { subtle: '#D9D2C9', input: '#BFB8B0' },
      },
      fontFamily: {
        serif:  ['Cormorant Garamond', 'Playfair Display', 'serif'],
        sans:   ['Inter', 'Nunito', 'system-ui', 'sans-serif'],
        script: ['Sacramento', 'Dancing Script', 'cursive'],
      },
      borderRadius: { sm: '6px', md: '12px', lg: '16px' },
    },
  },
  plugins: [],
}

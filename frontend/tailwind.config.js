export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        fog: '#EEF0F5',
        ink: '#171B2E',
        mute: '#575D75',
        line: '#D3D8E6',
        nura: { DEFAULT: '#4F5BFF', deep: '#3A45E0' },
        dawn: '#FFC2A8',
        sage: '#9FD8C1',
        alert: '#B3261E'
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

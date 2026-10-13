import { createTheme } from '@mui/material/styles'

// Same values as the @theme tokens in index.css.
export const NAVY = '#0f204b'
export const NAVY_DARK = '#0a1736'
export const NAVY_LIGHT = '#223b7a'
export const GOLD = '#b89047'
export const GOLD_LIGHT = '#c9a35a'
export const GOLD_TEXT = '#8a6a2c' // gold that is dark enough to read as text on white
export const GOLD_TINT = '#f4ecdb'

export const SANS = '"Inter Variable", "Inter", ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
export const SERIF = '"Playfair Display Variable", "Playfair Display", Georgia, "Times New Roman", serif'

const heading = { fontFamily: SERIF, fontWeight: 600, letterSpacing: '-0.01em' }

const theme = createTheme({
  palette: {
    primary: { main: NAVY, dark: NAVY_DARK, light: NAVY_LIGHT },
    // Gold buttons carry NAVY text (about 5.5:1). White on this gold would only reach ~3:1.
    secondary: { main: GOLD, light: GOLD_LIGHT, contrastText: NAVY_DARK },
    background: { default: '#f5f6fa', paper: '#ffffff' },
    text: { primary: '#1b2233', secondary: '#5b6477' },
    divider: '#e2e6ee',
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: SANS, // tables, forms and body copy stay clean sans-serif
    h1: heading,
    h2: heading,
    h3: heading,
    h4: { ...heading, fontSize: '1.75rem' },
    h5: { ...heading, fontSize: '1.45rem' },
    h6: { ...heading, fontSize: '1.15rem' },
    subtitle1: { ...heading, fontSize: '1.05rem' }, // card and section titles; subtitle2 stays sans for form labels
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        containedSecondary: { '&:hover': { backgroundColor: GOLD_LIGHT } },
      },
    },
  },
})

export default theme

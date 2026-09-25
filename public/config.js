/**
 * ─────────────────────────────────────────────────────────────────────
 *  PREVIEW PORTAL — YOUR SETTINGS
 *  This is the only file you need to edit. Every field is optional:
 *  leave a value empty ('') to hide that element.
 * ─────────────────────────────────────────────────────────────────────
 */
window.PORTAL_CONFIG = {
  // Your brand (login screen + viewer)
  brand: {
    name: 'Simon Trummer',
    tagline: 'Webdesign & Development',
    logo: '',                          // e.g. 'assets/img/logo.svg' — empty = your initials in a colored badge
    website: 'https://example.com',    // where your logo links to
  },

  // How clients can reach you (buttons in the viewer and in the feedback dialog)
  contact: {
    name: 'Simon',                     // used in texts like "Note from Simon"
    role: { en: 'Your web designer', de: 'Ihr Webdesigner' },
    photo: '',                         // e.g. 'assets/img/me.jpg' — empty = initials
    email: 'hello@example.com',
    phone: '+43 660 1234567',
    whatsapp: '+43 660 1234567',       // empty = no WhatsApp button
  },

  // Look & feel
  theme: 'dark',                       // 'dark' | 'light' | 'auto' (follows the visitor's system)
  accent: '#7C5CFF',                   // your main brand color
  accent2: '',                         // second gradient color — empty = calculated automatically

  // Language of the portal: 'de' (default), 'en' or 'auto' (visitor's browser language).
  // Visitors can always switch between DE and EN.
  language: 'de',

  // Behaviour
  projectsFolder: 'projects',          // the folder that contains your client projects
  defaultDevice: 'desktop',            // 'desktop' | 'tablet' | 'mobile' (a project's preview.json can override it)
  rememberDays: 30,                    // "Remember this device" duration — 0 disables the option
  showQrCode: true,                    // "Open on your phone" QR code in the viewer

  // Optional: receive feedback directly instead of via the client's email app.
  // Works with form services for static sites, e.g. Formspree (https://formspree.io) or Web3Forms.
  feedback: {
    formEndpoint: '',                  // e.g. 'https://formspree.io/f/abcdwxyz'
    extraFields: {},                   // e.g. { access_key: 'YOUR-WEB3FORMS-KEY' }
  },

  // Optional: change any text of the portal.
  // Example: texts: { de: { eyebrow: 'Exklusive Vorschau' }, en: { eyebrow: 'Exclusive preview' } }
  // All available keys are listed at the top of assets/js/portal.js.
  texts: {},
};

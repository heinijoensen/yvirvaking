// Yvirvaking — MyUplink OAuth configuration
// ⚠️  Rotate the client secret at dev.myuplink.com before production deployment.
// ⚠️  For a public deployment, move token exchange to a backend proxy so the
//     secret is never shipped in browser JS.
window.YVIRVAKING_CONFIG = {
  // Company / branding — used across all pages
  company: {
    name:       'Yvirvaking',
    adminName:  'Maria Poulsen',
    adminEmail: 'maria@yvirvaking.fo',
    country:    'Faroe Islands',
  },
  // Supabase — auth + data backend
  supabase: {
    url:     'https://atmshphkqcufvvzzsrhn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0bXNocGhrcWN1ZnZ2enpzcmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUwMDYsImV4cCI6MjA5NDM2MTAwNn0.mDUhcvJPw86Y9f5UYkEQq74SoQRWzbhPxXl6p9wbdRc',
  },
  // EmailJS — sign up free at emailjs.com, then paste your IDs here.
  // Leave blank to fall back to mailto: (opens your email client).
  emailjs: {
    publicKey:  '4AoE1yxml0RGIqpcL',   // "Public Key" from EmailJS → Account → General
    serviceId:  'service_iykx53w',   // "Service ID" from EmailJS → Email Services
    templateId: 'template_uhb6zl9',   // "Template ID" from EmailJS → Email Templates
    toEmail:    'maria@yvirvaking.fo', // where service reports are sent
  },
  // Minuba — field service management (jobs, service orders, time/materials)
  // Get your API key: Minuba → Settings → Administration → Integration Module
  minuba: {
    apiKey: 'FCRha1DhpwlMVmUTSYGQPZL3UFiEDh1q',
  },
  myuplink: {
    clientId:    'e35c4378-b6fc-4de8-ba86-0d409679b157',
    // clientSecret is NOT stored here — it lives in MYUPLINK_CLIENT_SECRET
    // on the server. Token exchange is proxied through /api/myuplink-token.
    redirectUri: 'https://yvirvakingtest.netlify.app/index.html',
    scopes:      'READSYSTEM',
    authUrl:     'https://api.myuplink.com/oauth/authorize',
    apiBase:     'https://api.myuplink.com/v2',
  }
};

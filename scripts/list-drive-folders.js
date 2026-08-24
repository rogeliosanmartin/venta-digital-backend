require('dotenv').config();
const { google } = require('googleapis');

(async () => {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (!refreshToken) {
    throw new Error('Falta GOOGLE_OAUTH_REFRESH_TOKEN en el .env');
  }
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  );
  oauth2.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2 });

  const about = await drive.about.get({ fields: 'user' });
  console.log(
    'Usuario OAuth:',
    about.data.user?.emailAddress,
    about.data.user?.displayName,
  );

  const list = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
    pageSize: 20,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  console.log('Carpetas visibles:');
  for (const f of list.data.files || []) {
    console.log(`- ${f.name} | ${f.id}`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

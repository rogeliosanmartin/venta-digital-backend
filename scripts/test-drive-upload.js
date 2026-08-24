/**
 * Prueba OAuth Drive. Si el folder del .env no es visible,
 * crea "Venta-Digital" en el Drive del usuario y sube ahí.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Readable } = require('stream');

function buildSimplePdf(lines) {
  const escaped = lines
    .map((l) =>
      String(l)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)'),
    )
    .join(') Tj T* (');
  const content = `BT /F1 11 Tf 50 750 Td 14 TL (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
    `4 0 obj<< /Length ${Buffer.byteLength(content)} >>stream\n${content}\nendstream\nendobj\n`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function main() {
  const configuredFolder = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    'http://localhost:3022/api/drive/oauth/callback';
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (!refreshToken) {
    throw new Error('Falta GOOGLE_OAUTH_REFRESH_TOKEN en el .env');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2 });

  const about = await drive.about.get({ fields: 'user' });
  console.log('Usuario:', about.data.user?.emailAddress);

  let folderId = configuredFolder;
  try {
    const meta = await drive.files.get({
      fileId: folderId,
      fields: 'id,name',
      supportsAllDrives: true,
    });
    console.log('Usando carpeta configurada:', meta.data.name, folderId);
  } catch {
    console.log(
      'Carpeta del .env no visible para este usuario. Creando "Venta-Digital"...',
    );
    const created = await drive.files.create({
      requestBody: {
        name: 'Venta-Digital',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id,name',
    });
    folderId = created.data.id;
    console.log('Nueva carpeta:', created.data.name, folderId);
    console.log(
      'Actualiza GOOGLE_DRIVE_FOLDER_ID en .env con ese ID (o comparte Comercial con este usuario).',
    );
  }

  const agentPath = path.resolve(process.cwd(), 'AGENT.md');
  const mdBuffer = fs.readFileSync(agentPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const pdfBuffer = buildSimplePdf([
    'Prueba Google Drive OAuth - Venta Digital',
    `Fecha: ${new Date().toISOString()}`,
    'Origen: AGENT.md',
    '',
    ...mdBuffer.toString('utf8').split(/\r?\n/).slice(0, 35),
  ]);

  const mdRes = await drive.files.create({
    requestBody: {
      name: `prueba-AGENT-${stamp}.md`,
      parents: [folderId],
    },
    media: { mimeType: 'text/markdown', body: Readable.from(mdBuffer) },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  const pdfRes = await drive.files.create({
    requestBody: {
      name: `prueba-AGENT-${stamp}.pdf`,
      parents: [folderId],
    },
    media: { mimeType: 'application/pdf', body: Readable.from(pdfBuffer) },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  console.log('OK MD:', {
    id: mdRes.data.id,
    name: mdRes.data.name,
    url:
      mdRes.data.webViewLink ||
      `https://drive.google.com/file/d/${mdRes.data.id}/view`,
  });
  console.log('OK PDF:', {
    id: pdfRes.data.id,
    name: pdfRes.data.name,
    url:
      pdfRes.data.webViewLink ||
      `https://drive.google.com/file/d/${pdfRes.data.id}/view`,
  });
  console.log('Carpeta:', `https://drive.google.com/drive/folders/${folderId}`);
  console.log('FOLDER_ID=', folderId);
}

main().catch((e) => {
  console.error('ERROR Drive:', e.message);
  if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});

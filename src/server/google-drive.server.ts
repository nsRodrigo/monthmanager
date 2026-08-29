// Troca o refresh token do usuário por um access token novo, e envia o
// backup pro Google Drive (pasta própria do app — escopo drive.file só
// enxerga arquivos criados por este app, não o Drive inteiro do usuário).

function requireGoogleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados no servidor — use o mesmo client OAuth já cadastrado no Supabase (Authentication → Providers → Google).",
    );
  }
  return { clientId, clientSecret };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = requireGoogleCredentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao renovar token do Google (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google não retornou access_token.");
  return json.access_token;
}

export async function uploadJsonToDrive(
  accessToken: string,
  fileName: string,
  jsonContent: string,
): Promise<{ id: string }> {
  const boundary = "finapp-backup-" + Math.random().toString(36).slice(2);
  const metadata = { name: fileName, mimeType: "application/json" };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao enviar backup pro Google Drive (${res.status}): ${text}`);
  }
  return (await res.json()) as { id: string };
}

export type DriveBackupFile = { id: string; name: string; createdTime: string; size?: string };

export async function listDriveBackupFiles(accessToken: string): Promise<DriveBackupFile[]> {
  const params = new URLSearchParams({
    q: "name contains 'backup-financeiro' and trashed = false",
    fields: "files(id,name,createdTime,size)",
    orderBy: "createdTime desc",
    pageSize: "50",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao listar backups no Google Drive (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { files?: DriveBackupFile[] };
  return json.files ?? [];
}

export async function downloadDriveFile(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao baixar backup do Google Drive (${res.status}): ${text}`);
  }
  return res.text();
}

/** Melhor esforço — revoga o refresh token no Google ao desconectar. Nunca lança. */
export async function revokeGoogleToken(refreshToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {
    // Melhor esforço — se o Google estiver fora do ar, ainda assim apagamos o token localmente.
  }
}

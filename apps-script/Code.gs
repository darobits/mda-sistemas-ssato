const SPREADSHEET_ID = '1eKotRyXuXUzW0xvi44LOc19KNFyEqXeugOMoWS-YLIE';
const TURNOS_SHEET_NAME = 'Turnos';
const DENUNCIAS_SHEET_NAME = 'Denuncias de robo';
const DENUNCIAS_FOLDER_NAME = 'Denuncias robo flotas SSATO';

const CALENDAR_ID = 'sistemasssato@gmail.com';
const SUPPORT_EMAIL = 'sistemasssato@gmail.com';
const LINKTREE_URL = 'https://linktr.ee/sistemasssato';

const MEMBRETE_MAIL_URL = 'https://mda-sistemas-ssato.vercel.app/membrete-mail.png';

const EVENT_DURATION_MINUTES = 30;
const MAX_DENUNCIA_FILES = 5;
const MAX_DENUNCIA_FILE_SIZE = 20 * 1024 * 1024;
const MAX_DENUNCIA_TOTAL_FILE_SIZE = 45 * 1024 * 1024;

const AVAILABLE_TIMES = [
  '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30',
];

const TURNOS_HEADERS = [
  'ID Turno',
  'Fecha de registro',
  'Nombre y apellido',
  'Correo',
  'Es Gmail',
  'CUIL/CUIT',
  'Tipo de solicitud',
  'Equipo',
  'Descripción',
  'Fecha turno',
  'Hora turno',
  'Mail enviado',
  'Calendar SSATO',
  'Invitación usuario',
  'Repartición',
  'Otra repartición',
];

const DENUNCIAS_HEADERS = [
  'ID Denuncia',
  'Fecha de registro',
  'Nombre y apellido',
  'Correo',
  'CUIL/CUIT',
  'Teléfono de contacto',
  'Tipo de línea',
  'Número de línea robada',
  'Marca del celular',
  'Otra marca',
  'Modelo del celular',
  'Archivos denuncia',
  'Mail enviado',
  'Repartición',
  'Otra repartición',
];

function doPost(e) {
  try {
    const payload = parseRequestPayload(e);

    if (payload.formType === 'denuncia-robo-flotas') {
      return handleDenuncia(payload);
    }

    return handleTurno(payload);
  } catch (error) {
    return jsonResponse({ ok: false, error: getPublicErrorMessage(error) });
  }
}

function handleTurno(payload) {
  const data = validateTurnoPayload(payload);
  const sheet = getSheet(TURNOS_SHEET_NAME, TURNOS_HEADERS);
  const lock = LockService.getScriptLock();
  let idTurno = '';
  let rowNumber = 0;
  let isGmail = false;

  acquireLock(lock);

  try {
    idTurno = nextId(sheet, `TU-${new Date().getFullYear()}-`);
    const registro = new Date();
    isGmail = data.correo.toLowerCase().endsWith('@gmail.com');

    sheet.appendRow([
      idTurno,
      registro,
      data.nombre,
      data.correo,
      isGmail ? 'Sí' : 'No',
      data.cuil,
      data.tipoSolicitud,
      data.equipo,
      data.descripcion,
      data.fechaTurno,
      data.horaTurno,
      'Procesando',
      'Procesando',
      isGmail ? 'Procesando' : 'No',
      data.reparticion,
      data.otraReparticion,
    ]);

    rowNumber = sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }

  const calendarResult = safeRun(
    () => createCalendarEvent(data, idTurno, isGmail),
    { created: false, invited: false, error: '' }
  );
  const mailResult = safeRun(() => sendTurnoConfirmationEmail(data, idTurno), false);

  safeRun(() => {
    sheet.getRange(rowNumber, 12, 1, 3).setValues([[
      mailResult ? 'Sí' : 'No',
      calendarResult.created ? 'Sí' : 'No',
      calendarResult.invited ? 'Sí' : 'No',
    ]]);
  }, false);

  return jsonResponse({ ok: true, idTurno });
}

function handleDenuncia(payload) {
  const data = validateDenunciaPayload(payload);
  const sheet = getSheet(DENUNCIAS_SHEET_NAME, DENUNCIAS_HEADERS);
  const lock = LockService.getScriptLock();
  let idDenuncia = '';
  let rowNumber = 0;

  acquireLock(lock);

  try {
    idDenuncia = nextId(sheet, `DR-${new Date().getFullYear()}-`);
    const registro = new Date();

    sheet.appendRow([
      idDenuncia,
      registro,
      data.nombre,
      data.correo,
      data.cuil,
      data.telefonoContacto,
      data.tipoLinea,
      data.numeroLineaRobada,
      data.marcaCelular,
      data.otraMarca,
      data.modeloCelular,
      'Procesando archivos',
      'Procesando',
      data.reparticion,
      data.otraReparticion,
    ]);

    rowNumber = sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }

  const filesResult = safeRun(() => saveDenunciaFiles(data.archivos, idDenuncia), null);

  if (!filesResult) {
    safeRun(() => {
      sheet.getRange(rowNumber, 12, 1, 2).setValues([[
        'Error al guardar archivos',
        'No',
      ]]);
    }, false);

    return jsonResponse({
      ok: false,
      error: 'No se pudieron guardar los archivos adjuntos. Probá con archivos más livianos o intentá nuevamente.',
    });
  }

  const mailResult = safeRun(() => sendDenunciaConfirmationEmail(data, idDenuncia), false);

  safeRun(() => {
    sheet.getRange(rowNumber, 12, 1, 2).setValues([[
      filesResult.join('\n'),
      mailResult ? 'Sí' : 'No',
    ]]);
  }, false);

  return jsonResponse({ ok: true, idDenuncia });
}

function parseRequestPayload(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') {
    throw new Error('Solicitud inválida.');
  }

  try {
    return JSON.parse(e.postData.contents || '{}');
  } catch (error) {
    throw new Error('El formato de la solicitud no es válido.');
  }
}

function acquireLock(lock) {
  if (!lock.tryLock(10000)) {
    throw new Error('El sistema está procesando muchas solicitudes. Intentá nuevamente en unos segundos.');
  }
}

function safeRun(callback, fallbackValue) {
  try {
    return callback();
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return fallbackValue;
  }
}

function getPublicErrorMessage(error) {
  const message = String(error && error.message ? error.message : 'No se pudo procesar la solicitud.');

  if (/Exception|Service|ScriptError|TypeError|ReferenceError/i.test(message)) {
    return 'No se pudo procesar la solicitud. Intentá nuevamente en unos minutos.';
  }

  return message;
}

function validateTurnoPayload(payload) {
  const data = {
    nombre: String(payload.nombre || '').trim(),
    correo: String(payload.correo || '').trim(),
    cuil: String(payload.cuil || '').trim(),
    reparticion: String(payload.reparticion || '').trim(),
    otraReparticion: String(payload.otraReparticion || '').trim(),
    tipoSolicitud: String(payload.tipoSolicitud || '').trim(),
    equipo: String(payload.equipo || '').trim(),
    descripcion: String(payload.descripcion || '').trim(),
    fechaTurno: String(payload.fechaTurno || '').trim(),
    horaTurno: String(payload.horaTurno || '').trim(),
  };

  requireFields(data, ['nombre', 'correo', 'cuil', 'reparticion', 'tipoSolicitud', 'equipo', 'fechaTurno', 'horaTurno']);
  validateNombre(data.nombre);
  validateEmail(data.correo);
  validateCuil(data.cuil);

  if (data.reparticion === 'Otro' && !data.otraReparticion) {
    throw new Error('Indicá la repartición.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = parseDate(data.fechaTurno);

  if (selectedDate < today) {
    throw new Error('La fecha no puede ser anterior a hoy.');
  }

  if (!isBusinessDay(selectedDate)) {
    throw new Error('Seleccioná un día hábil, de lunes a viernes.');
  }

  if (!AVAILABLE_TIMES.includes(data.horaTurno)) {
    throw new Error('El horario seleccionado no está disponible.');
  }

  return data;
}

function validateDenunciaPayload(payload) {
  const data = {
    nombre: String(payload.nombre || '').trim(),
    correo: String(payload.correo || '').trim(),
    cuil: String(payload.cuil || '').trim(),
    reparticion: String(payload.reparticion || '').trim(),
    otraReparticion: String(payload.otraReparticion || '').trim(),
    telefonoContacto: String(payload.telefonoContacto || '').trim(),
    tipoLinea: String(payload.tipoLinea || '').trim(),
    numeroLineaRobada: String(payload.numeroLineaRobada || '').trim(),
    marcaCelular: String(payload.marcaCelular || '').trim(),
    otraMarca: String(payload.otraMarca || '').trim(),
    modeloCelular: String(payload.modeloCelular || '').trim(),
    archivos: Array.isArray(payload.archivos) ? payload.archivos : [],
  };

  requireFields(data, [
    'nombre',
    'correo',
    'cuil',
    'reparticion',
    'telefonoContacto',
    'tipoLinea',
    'numeroLineaRobada',
    'marcaCelular',
  ]);

  validateNombre(data.nombre);
  validateEmail(data.correo);
  validateCuil(data.cuil);
  validateTelefono(data.telefonoContacto);

  if (data.reparticion === 'Otro' && !data.otraReparticion) {
    throw new Error('Indicá la repartición.');
  }

  if (data.marcaCelular === 'Otro' && !data.otraMarca) {
    throw new Error('Indicá la marca del celular.');
  }

  if (data.archivos.length === 0 || data.archivos.length > MAX_DENUNCIA_FILES) {
    throw new Error(`Adjuntá entre 1 y ${MAX_DENUNCIA_FILES} archivos.`);
  }

  let totalFileSize = 0;

  data.archivos.forEach((file) => {
    if (!file.name || !file.data) {
      throw new Error('Uno de los archivos adjuntos no es válido.');
    }

    const fileSize = Number(file.size || 0);
    totalFileSize += fileSize;

    if (fileSize > MAX_DENUNCIA_FILE_SIZE) {
      throw new Error(`El archivo "${file.name}" supera los ${formatBytes(MAX_DENUNCIA_FILE_SIZE)} permitidos.`);
    }

    if (!isAllowedDenunciaFile(file)) {
      throw new Error('Solo se aceptan archivos PDF o imágenes.');
    }

    file.mimeType = getDenunciaMimeType(file);
  });

  if (totalFileSize > MAX_DENUNCIA_TOTAL_FILE_SIZE) {
    throw new Error(`Los archivos adjuntos superan el peso total permitido de ${formatBytes(MAX_DENUNCIA_TOTAL_FILE_SIZE)}. Subí archivos más livianos.`);
  }

  return data;
}

function requireFields(data, fields) {
  fields.forEach((field) => {
    if (!data[field]) {
      throw new Error('Falta completar campos obligatorios.');
    }
  });
}

function validateNombre(nombre) {
  const limpio = nombre.replace(/\s+/g, ' ').trim();

  if (limpio.length < 5 || limpio.split(' ').length < 2) {
    throw new Error('Ingresá nombre y apellido.');
  }
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo no tiene un formato válido.');
  }
}

function validateCuil(cuil) {
  if (cuil.replace(/\D/g, '').length !== 11) {
    throw new Error('El CUIL/CUIT debe tener 11 números.');
  }
}

function validateTelefono(telefono) {
  if (telefono.replace(/\D/g, '').length < 8) {
    throw new Error('El teléfono debe tener al menos 8 números.');
  }
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName) {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function isAllowedDenunciaFile(file) {
  const mimeType = String(file.mimeType || '').toLowerCase();
  const extension = getFileExtension(file.name);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif'];

  return (
    mimeType === 'application/pdf' ||
    mimeType.indexOf('image/') === 0 ||
    extension === 'pdf' ||
    imageExtensions.indexOf(extension) !== -1
  );
}

function getDenunciaMimeType(file) {
  const mimeType = String(file.mimeType || '').toLowerCase();
  const extension = getFileExtension(file.name);

  if (mimeType && mimeType !== 'application/octet-stream') {
    return mimeType;
  }

  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg') return 'image/jpeg';
  if (extension) return `image/${extension}`;

  return 'application/octet-stream';
}

function isBusinessDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function getSheet(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    syncHeaders(sheet, headers);
  }

  return sheet;
}

function syncHeaders(sheet, headers) {
  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];

  headers.forEach((header) => {
    if (currentHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
}

function nextId(sheet, prefix) {
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();

    ids.forEach((id) => {
      const value = String(id || '');

      if (value.startsWith(prefix)) {
        const number = Number(value.replace(prefix, ''));

        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    });
  }

  return `${prefix}${String(maxNumber + 1).padStart(6, '0')}`;
}

function saveDenunciaFiles(files, idDenuncia) {
  const folder = getOrCreateFolder(DENUNCIAS_FOLDER_NAME);

  return files.map((file, index) => {
    const bytes = Utilities.base64Decode(file.data);
    const fileName = sanitizeFileName(file.name);
    const blob = Utilities.newBlob(bytes, file.mimeType, `${idDenuncia}-${index + 1}-${fileName}`);
    const driveFile = folder.createFile(blob);

    return driveFile.getUrl();
  });
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function sanitizeFileName(fileName) {
  return String(fileName || 'archivo').replace(/[\\/:*?"<>|]/g, '-');
}

function createCalendarEvent(data, idTurno, isGmail) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const start = parseDateTime(data.fechaTurno, data.horaTurno);
  const end = new Date(start.getTime() + EVENT_DURATION_MINUTES * 60000);

  const reparticion = data.reparticion + (data.otraReparticion ? ` - ${data.otraReparticion}` : '');
  const descripcionSolicitud = data.descripcion || 'Sin descripción';

  const description = [
    'Mesa de Ayuda SSATO',
    '',
    `Ticket: ${idTurno}`,
    '',
    'Datos del solicitante',
    `• Nombre: ${data.nombre}`,
    `• Correo: ${data.correo}`,
    `• CUIL/CUIT: ${data.cuil}`,
    `• Repartición: ${reparticion}`,
    '',
    'Detalle de la solicitud',
    `• Tipo: ${data.tipoSolicitud}`,
    `• Equipo: ${data.equipo}`,
    `• Descripción: ${descripcionSolicitud}`,
    '',
    'Recordatorio',
    '• Traer el equipo y cargador si corresponde.',
    '• Indicar el número de inventario si lo conoce.',
    '• Avisar si no podés asistir al turno.',
    '',
    'Área de Sistemas SSATO',
  ].join('\n');

  const event = calendar.createEvent(`Turno SSATO - ${data.nombre}`, start, end, {
    description,
    guests: isGmail ? data.correo : '',
    sendInvites: isGmail,
  });

  return { created: Boolean(event), invited: isGmail };
}

function getMailFooter() {
  return `
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid #d1d5db;font-family:Arial,Helvetica,sans-serif;color:#4b5563;line-height:1.55;font-size:13px;">
      <div style="font-weight:700;color:#374151;">Área de Sistemas SSATO</div>
      <div style="color:#4b5563;">Mesa de Ayuda</div>
      <div style="color:#9ca3af;margin:8px 0;">────────────────────────────</div>
      <div>
        Portal de Recursos:
        <a href="${LINKTREE_URL}" target="_blank" style="color:#4338ca;font-weight:600;text-decoration:none;">
          ${LINKTREE_URL}
        </a>
      </div>
    </div>

    <div style="margin-top:22px;">
      <img src="${MEMBRETE_MAIL_URL}" alt="Membrete SSATO" style="max-width:100%;width:700px;height:auto;display:block;border-radius:10px;">
    </div>
  `;
}

function sendTurnoConfirmationEmail(data, idTurno) {
  const subject = 'Turno confirmado - Revisión técnica SSATO';

  const htmlBody = `
    <div style="background:#f5f7fb;padding:28px 0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        
        <div style="background:linear-gradient(135deg,#111827,#312e81);padding:26px 30px;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#c7d2fe;font-weight:700;">
            Mesa de Ayuda SSATO
          </div>
          <h1 style="margin:8px 0 0 0;font-size:26px;line-height:1.2;">
            Turno confirmado
          </h1>
        </div>

        <div style="padding:28px 30px;line-height:1.6;">
          <p style="margin-top:0;">Hola <b>${escapeHtml(data.nombre)}</b>,</p>

          <p>Tu turno fue registrado correctamente en la Mesa de Ayuda SSATO.</p>

          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-left:6px solid #4f46e5;padding:18px 20px;margin:22px 0;border-radius:14px;">
            <p style="margin:0 0 12px 0;color:#3730a3;font-weight:700;font-size:15px;">
              Detalle del turno
            </p>

            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111827;">
              <tr>
                <td style="padding:6px 0;color:#4b5563;width:120px;">Ticket</td>
                <td style="padding:6px 0;font-weight:700;">${idTurno}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#4b5563;">Fecha</td>
                <td style="padding:6px 0;font-weight:700;">${data.fechaTurno}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#4b5563;">Horario</td>
                <td style="padding:6px 0;font-weight:700;">${data.horaTurno}</td>
              </tr>
            </table>
          </div>

          <p>Te esperamos en el Área de Sistemas SSATO para realizar la revisión correspondiente.</p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px;margin-top:20px;">
            <p style="margin:0 0 8px 0;font-weight:700;color:#374151;">Importante</p>
            <ul style="margin:0;padding-left:20px;color:#374151;">
              <li>Traer el equipo y cargador si corresponde.</li>
              <li>Indicar el número de inventario si lo conoce.</li>
              <li>Avisar si no podés asistir al turno.</li>
            </ul>
          </div>

          <p style="margin-top:24px;">Muchas gracias.</p>

          ${getMailFooter()}
        </div>
      </div>
    </div>
  `;

  GmailApp.sendEmail(data.correo, subject, 'Tu turno fue registrado correctamente.', {
    name: 'Sistemas SSATO',
    replyTo: SUPPORT_EMAIL,
    htmlBody,
  });

  return true;
}

function sendDenunciaConfirmationEmail(data, idDenuncia) {
  const subject = 'Denuncia recibida - Flotas SSATO';

  const htmlBody = `
    <div style="background:#f5f7fb;padding:28px 0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        
        <div style="background:linear-gradient(135deg,#111827,#312e81);padding:26px 30px;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#c7d2fe;font-weight:700;">
            Mesa de Ayuda SSATO
          </div>
          <h1 style="margin:8px 0 0 0;font-size:26px;line-height:1.2;">
            Denuncia recibida
          </h1>
        </div>

        <div style="padding:28px 30px;line-height:1.6;">
          <p style="margin-top:0;">Hola <b>${escapeHtml(data.nombre)}</b>,</p>

          <p>Recibimos tu denuncia de robo de flota.</p>

          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-left:6px solid #4f46e5;padding:18px 20px;margin:22px 0;border-radius:14px;">
            <p style="margin:0 0 12px 0;color:#3730a3;font-weight:700;font-size:15px;">
              Detalle de la denuncia
            </p>

            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111827;">
              <tr>
                <td style="padding:6px 0;color:#4b5563;width:140px;">ID de denuncia</td>
                <td style="padding:6px 0;font-weight:700;">${idDenuncia}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#4b5563;">Línea robada</td>
                <td style="padding:6px 0;font-weight:700;">${escapeHtml(data.numeroLineaRobada)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#4b5563;">Tipo de línea</td>
                <td style="padding:6px 0;font-weight:700;">${escapeHtml(data.tipoLinea)}</td>
              </tr>
            </table>
          </div>

          <p>El Área de Sistemas SSATO revisará la documentación adjunta para gestionar el trámite de reposición, según corresponda.</p>

          <p style="margin-top:24px;">Muchas gracias.</p>

          ${getMailFooter()}
        </div>
      </div>
    </div>
  `;

  GmailApp.sendEmail(data.correo, subject, 'Recibimos tu denuncia de robo de flota.', {
    name: 'Sistemas SSATO',
    replyTo: SUPPORT_EMAIL,
    htmlBody,
  });

  return true;
}

function parseDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ''))) {
    throw new Error('La fecha no tiene un formato válido.');
  }

  const parts = dateValue.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) {
    throw new Error('La fecha seleccionada no es válida.');
  }

  return date;
}

function parseDateTime(dateValue, timeValue) {
  if (!/^\d{2}:\d{2}$/.test(String(timeValue || ''))) {
    throw new Error('La hora no tiene un formato válido.');
  }

  const parsedDate = parseDate(dateValue);
  const timeParts = timeValue.split(':').map(Number);

  if (timeParts[0] > 23 || timeParts[1] > 59) {
    throw new Error('La hora seleccionada no es válida.');
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    timeParts[0],
    timeParts[1]
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

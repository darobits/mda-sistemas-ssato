const SPREADSHEET_NAME = 'Turnera SSATO';
const TURNOS_SHEET_NAME = 'Turnos';
const DENUNCIAS_SHEET_NAME = 'Denuncias de robo';
const DENUNCIAS_FOLDER_NAME = 'Denuncias robo flotas SSATO';
const CALENDAR_ID = 'sistemasssato@gmail.com';
const SUPPORT_EMAIL = 'sistemasssato@gmail.com';
const LINKTREE_URL = 'https://linktr.ee/sistemasssato';
const EVENT_DURATION_MINUTES = 30;
const AVAILABLE_TIMES = [
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
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
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (payload.formType === 'denuncia-robo-flotas') {
      return handleDenuncia(payload);
    }

    return handleTurno(payload);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function handleTurno(payload) {
  const data = validateTurnoPayload(payload);
  const sheet = getSheet(TURNOS_SHEET_NAME, TURNOS_HEADERS);
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const idTurno = nextId(sheet, `TU-${new Date().getFullYear()}-`);
    const registro = new Date();
    const isGmail = data.correo.toLowerCase().endsWith('@gmail.com');
    const calendarResult = createCalendarEvent(data, idTurno, isGmail);
    const mailResult = sendTurnoConfirmationEmail(data, idTurno);

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
      mailResult ? 'Sí' : 'No',
      calendarResult.created ? 'Sí' : 'No',
      calendarResult.invited ? 'Sí' : 'No',
    ]);

    return jsonResponse({ ok: true, idTurno });
  } finally {
    lock.releaseLock();
  }
}

function handleDenuncia(payload) {
  const data = validateDenunciaPayload(payload);
  const sheet = getSheet(DENUNCIAS_SHEET_NAME, DENUNCIAS_HEADERS);
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const idDenuncia = nextId(sheet, `DR-${new Date().getFullYear()}-`);
    const registro = new Date();
    const fileUrls = saveDenunciaFiles(data.archivos, idDenuncia);
    const mailResult = sendDenunciaConfirmationEmail(data, idDenuncia);

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
      fileUrls.join('\n'),
      mailResult ? 'Sí' : 'No',
    ]);

    return jsonResponse({ ok: true, idDenuncia });
  } finally {
    lock.releaseLock();
  }
}

function validateTurnoPayload(payload) {
  const data = {
    nombre: String(payload.nombre || '').trim(),
    correo: String(payload.correo || '').trim(),
    cuil: String(payload.cuil || '').trim(),
    tipoSolicitud: String(payload.tipoSolicitud || '').trim(),
    equipo: String(payload.equipo || '').trim(),
    descripcion: String(payload.descripcion || '').trim(),
    fechaTurno: String(payload.fechaTurno || '').trim(),
    horaTurno: String(payload.horaTurno || '').trim(),
  };

  requireFields(data, ['nombre', 'correo', 'cuil', 'tipoSolicitud', 'equipo', 'fechaTurno', 'horaTurno']);
  validateEmail(data.correo);
  validateCuil(data.cuil);

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
    'telefonoContacto',
    'tipoLinea',
    'numeroLineaRobada',
    'marcaCelular',
  ]);
  validateEmail(data.correo);
  validateCuil(data.cuil);

  if (data.marcaCelular === 'Otro' && !data.otraMarca) {
    throw new Error('Indicá la marca del celular.');
  }

  if (data.archivos.length === 0 || data.archivos.length > 5) {
    throw new Error('Adjuntá entre 1 y 5 archivos.');
  }

  data.archivos.forEach((file) => {
    if (!file.name || !file.mimeType || !file.data) {
      throw new Error('Uno de los archivos adjuntos no es válido.');
    }

    if (!/^image\//.test(file.mimeType) && file.mimeType !== 'application/pdf') {
      throw new Error('Solo se aceptan archivos PDF o imágenes.');
    }
  });

  return data;
}

function requireFields(data, fields) {
  fields.forEach((field) => {
    if (!data[field]) {
      throw new Error('Falta completar campos obligatorios.');
    }
  });
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

function isBusinessDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function getSheet(sheetName, headers) {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  const spreadsheet = files.hasNext()
    ? SpreadsheetApp.open(files.next())
    : SpreadsheetApp.create(SPREADSHEET_NAME);

  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
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
    const extensionName = sanitizeFileName(file.name);
    const blob = Utilities.newBlob(bytes, file.mimeType, `${idDenuncia}-${index + 1}-${extensionName}`);
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
  const description = [
    `Ticket: ${idTurno}`,
    `Solicitante: ${data.nombre}`,
    `Correo: ${data.correo}`,
    `CUIL/CUIT: ${data.cuil}`,
    `Tipo de solicitud: ${data.tipoSolicitud}`,
    `Equipo: ${data.equipo}`,
    `Descripción: ${data.descripcion || 'Sin descripción'}`,
  ].join('\n');

  const event = calendar.createEvent(`Turno SSATO - ${data.nombre}`, start, end, {
    description,
    guests: isGmail ? data.correo : '',
    sendInvites: isGmail,
  });

  return { created: Boolean(event), invited: isGmail };
}

function sendTurnoConfirmationEmail(data, idTurno) {
  const subject = '✅ Turno confirmado - Revisión técnica SSATO';
  const body = `Hola ${data.nombre},

Tu turno fue registrado correctamente.

Ticket: ${idTurno}

📅 Fecha: ${data.fechaTurno}
🕙 Horario: ${data.horaTurno}

Te esperamos en el Área de Sistemas SSATO para realizar la revisión correspondiente.

Importante:
• Traer el equipo y cargador si corresponde.
• Indicar el número de inventario si lo conoce.
• Avisar si no podés asistir al turno.

Muchas gracias.

Sistemas SSATO
Soporte Técnico

────────────────────────────

Sistemas SSATO
Subsecretaría de Abordaje Territorial y Obras

📧 ${SUPPORT_EMAIL}

Portal de Recursos:
${LINKTREE_URL}`;

  GmailApp.sendEmail(data.correo, subject, body, {
    name: 'Sistemas SSATO',
    replyTo: SUPPORT_EMAIL,
  });

  return true;
}

function sendDenunciaConfirmationEmail(data, idDenuncia) {
  const subject = 'Denuncia recibida - Flotas SSATO';
  const body = `Hola ${data.nombre},

Recibimos tu denuncia de robo de flota.

ID de denuncia: ${idDenuncia}
Línea robada: ${data.numeroLineaRobada}
Tipo de línea: ${data.tipoLinea}

El Área de Sistemas SSATO revisará la documentación adjunta para gestionar el trámite de reposición, según corresponda.

Muchas gracias.

Sistemas SSATO
Soporte Técnico

📧 ${SUPPORT_EMAIL}`;

  GmailApp.sendEmail(data.correo, subject, body, {
    name: 'Sistemas SSATO',
    replyTo: SUPPORT_EMAIL,
  });

  return true;
}

function parseDate(dateValue) {
  const parts = dateValue.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function parseDateTime(dateValue, timeValue) {
  const dateParts = dateValue.split('-').map(Number);
  const timeParts = timeValue.split(':').map(Number);
  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

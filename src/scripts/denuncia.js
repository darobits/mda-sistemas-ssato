import { APPS_SCRIPT_URL } from './config.js';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_EXTENSIONS = ['pdf'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif'];

const form = document.querySelector('#denuncia-form');
const submitButton = document.querySelector('#denuncia-submit');
const statusMessage = document.querySelector('#denuncia-status');

const requiredMessages = {
	nombre: 'Ingresá tu nombre y apellido.',
	correo: 'Ingresá un correo válido.',
	cuil: 'Ingresá tu CUIL/CUIT sin guiones.',
	telefonoContacto: 'Ingresá un teléfono de contacto.',
	tipoLinea: 'Seleccioná el tipo de línea.',
	numeroLineaRobada: 'Ingresá el número de línea robada.',
	marcaCelular: 'Seleccioná la marca del celular.',
	denunciaArchivos: 'Adjuntá la denuncia policial.',
};

function getValue(formData, key) {
	return String(formData.get(key) || '').trim();
}

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasMinWords(value) {
	return value.trim().split(/\s+/).filter(Boolean).length >= 2;
}

function setError(fieldName, message) {
	const field = form.elements[fieldName];
	const error = form.querySelector(`[data-error-for="${fieldName}"]`);

	if (field) {
		field.setAttribute('aria-invalid', message ? 'true' : 'false');
	}

	if (error) {
		error.textContent = message;
	}
}

function clearErrors() {
	Object.keys(requiredMessages).forEach((fieldName) => setError(fieldName, ''));
	setError('otraMarca', '');
}

function getFiles() {
	const fileInput = form.elements.denunciaArchivos;
	return Array.from(fileInput.files || []);
}

function validatePhone(value) {
	return value.replace(/\D/g, '').length >= 8;
}

function getFileExtension(fileName) {
	return String(fileName || '').split('.').pop().toLowerCase();
}

function isAllowedFile(file) {
	const mimeType = String(file.type || '').toLowerCase();
	const extension = getFileExtension(file.name);

	return (
		mimeType === 'application/pdf' ||
		mimeType.startsWith('image/') ||
		PDF_EXTENSIONS.includes(extension) ||
		IMAGE_EXTENSIONS.includes(extension)
	);
}

function getMimeType(file) {
	const mimeType = String(file.type || '').toLowerCase();
	const extension = getFileExtension(file.name);

	if (mimeType) return mimeType;
	if (PDF_EXTENSIONS.includes(extension)) return 'application/pdf';
	if (IMAGE_EXTENSIONS.includes(extension)) return `image/${extension === 'jpg' ? 'jpeg' : extension}`;

	return 'application/octet-stream';
}

function validate(payload, files) {
	const errors = {};
	const cuilNumbers = payload.cuil.replace(/\D/g, '');

	Object.entries(requiredMessages).forEach(([fieldName, message]) => {
		if (fieldName === 'denunciaArchivos') return;
		if (!payload[fieldName]) errors[fieldName] = message;
	});

	if (payload.nombre && !hasMinWords(payload.nombre)) {
		errors.nombre = 'Ingresá nombre y apellido.';
	}

	if (payload.correo && !isValidEmail(payload.correo)) {
		errors.correo = 'Revisá el formato del correo.';
	}

	if (payload.cuil && cuilNumbers.length !== 11) {
		errors.cuil = 'El CUIL/CUIT debe tener exactamente 11 números.';
	}

	if (payload.telefonoContacto && !validatePhone(payload.telefonoContacto)) {
		errors.telefonoContacto = 'Ingresá un teléfono válido.';
	}

	if (payload.numeroLineaRobada && !validatePhone(payload.numeroLineaRobada)) {
		errors.numeroLineaRobada = 'Ingresá un número de línea válido.';
	}

	if (payload.marcaCelular === 'Otro' && !payload.otraMarca) {
		errors.otraMarca = 'Indicá la marca del celular.';
	}

	if (files.length === 0) {
		errors.denunciaArchivos = 'Adjuntá la denuncia policial.';
	} else if (files.length > MAX_FILES) {
		errors.denunciaArchivos = 'Podés adjuntar hasta 5 archivos.';
	} else {
		const invalidFile = files.find((file) => !isAllowedFile(file));
		const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE);

		if (invalidFile) errors.denunciaArchivos = 'Solo se aceptan archivos PDF o imágenes.';
		if (oversizedFile) errors.denunciaArchivos = 'Cada archivo debe pesar 10 MB o menos.';
	}

	return errors;
}

function payloadFromForm() {
	const formData = new FormData(form);

	return {
		formType: 'denuncia-robo-flotas',
		nombre: getValue(formData, 'nombre'),
		correo: getValue(formData, 'correo'),
		cuil: getValue(formData, 'cuil'),
		telefonoContacto: getValue(formData, 'telefonoContacto'),
		tipoLinea: getValue(formData, 'tipoLinea'),
		numeroLineaRobada: getValue(formData, 'numeroLineaRobada'),
		marcaCelular: getValue(formData, 'marcaCelular'),
		otraMarca: getValue(formData, 'otraMarca'),
		modeloCelular: getValue(formData, 'modeloCelular'),
	};
}

function showErrors(errors) {
	Object.entries(errors).forEach(([fieldName, message]) => setError(fieldName, message));
	const firstInvalid = form.querySelector('[aria-invalid="true"]');
	firstInvalid?.focus();
}

function showSuccessModal({ title, message, detail }) {
	const modal = document.createElement('div');
	modal.className = 'success-modal';
	modal.innerHTML = `
		<div class="success-modal-card" role="dialog" aria-modal="true" aria-labelledby="success-title">
			<div class="success-modal-icon" aria-hidden="true">✓</div>
			<h2 id="success-title">${title}</h2>
			<p>${message}</p>
			<strong>${detail}</strong>
			<small>Te redirigimos al inicio en unos segundos.</small>
		</div>
	`;
	document.body.appendChild(modal);
	setTimeout(() => {
		window.location.href = '/';
	}, 3200);
}

function fileToPayload(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			const result = String(reader.result || '');
			resolve({
				name: file.name,
				mimeType: getMimeType(file),
				size: file.size,
				data: result.split(',')[1],
			});
		};

		reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file.name}.`));
		reader.readAsDataURL(file);
	});
}

async function submitDenuncia(payload) {
	const response = await fetch(APPS_SCRIPT_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain;charset=utf-8',
		},
		body: JSON.stringify(payload),
	});

	const result = await response.json();

	if (!response.ok || !result.ok) {
		throw new Error(result.error || 'No se pudo enviar la denuncia.');
	}

	return result;
}

if (form) {
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		clearErrors();
		statusMessage.textContent = '';
		statusMessage.className = 'form-status';

		const files = getFiles();
		const payload = payloadFromForm();
		const errors = validate(payload, files);

		if (Object.keys(errors).length > 0) {
			showErrors(errors);
			statusMessage.textContent = 'Revisá los campos marcados.';
			statusMessage.classList.add('is-error');
			return;
		}

		if (APPS_SCRIPT_URL.includes('PEGAR_URL')) {
			statusMessage.textContent = 'Falta configurar la URL del Web App de Apps Script.';
			statusMessage.classList.add('is-error');
			return;
		}

		submitButton.disabled = true;
		submitButton.textContent = 'Enviando...';

		try {
			const archivos = await Promise.all(files.map(fileToPayload));
			const result = await submitDenuncia({ ...payload, archivos });
			form.reset();
			showSuccessModal({
				title: 'Denuncia enviada',
				message: 'Recibimos la documentación correctamente.',
				detail: `ID: ${result.idDenuncia}`,
			});
		} catch (error) {
			statusMessage.textContent = error.message || 'Ocurrió un error al enviar la denuncia.';
			statusMessage.classList.add('is-error');
		} finally {
			submitButton.disabled = false;
			submitButton.textContent = 'Enviar denuncia';
		}
	});
}

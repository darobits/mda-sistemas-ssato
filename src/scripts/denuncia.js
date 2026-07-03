import { APPS_SCRIPT_URL } from './config.js';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 45 * 1024 * 1024;
const PDF_EXTENSIONS = ['pdf'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif'];

const form = document.querySelector('#denuncia-form');
const submitButton = document.querySelector('#denuncia-submit');
const statusMessage = document.querySelector('#denuncia-status');

const requiredMessages = {
	nombre: 'Ingresá tu nombre y apellido.',
	correo: 'Ingresá un correo válido.',
	cuil: 'Ingresá tu CUIL/CUIT sin guiones.',
	reparticion: 'Seleccioná la repartición.',
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
	setError('otraReparticion', '');
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

function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
	return `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
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

function getFilesError(files) {
	if (files.length === 0) {
		return 'Adjuntá la denuncia policial.';
	}

	if (files.length > MAX_FILES) {
		return `Podés adjuntar hasta ${MAX_FILES} archivos. Seleccionaste ${files.length}.`;
	}

	const invalidFile = files.find((file) => !isAllowedFile(file));

	if (invalidFile) {
		return `El archivo "${invalidFile.name}" no es válido. Solo se aceptan PDF o imágenes.`;
	}

	const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE);

	if (oversizedFile) {
		return `El archivo "${oversizedFile.name}" pesa ${formatBytes(oversizedFile.size)}. Máximo permitido: ${formatBytes(MAX_FILE_SIZE)}.`;
	}

	const totalSize = files.reduce((total, file) => total + file.size, 0);

	if (totalSize > MAX_TOTAL_FILE_SIZE) {
		return `Los archivos pesan ${formatBytes(totalSize)} en total. Para evitar errores de carga, el máximo total es ${formatBytes(MAX_TOTAL_FILE_SIZE)}.`;
	}

	return '';
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

	if (payload.reparticion === 'Otro' && !payload.otraReparticion) {
		errors.otraReparticion = 'Indicá la repartición.';
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

	const filesError = getFilesError(files);
	if (filesError) errors.denunciaArchivos = filesError;

	return errors;
}

function payloadFromForm() {
	const formData = new FormData(form);

	return {
		formType: 'denuncia-robo-flotas',
		nombre: getValue(formData, 'nombre'),
		correo: getValue(formData, 'correo'),
		cuil: getValue(formData, 'cuil'),
		reparticion: getValue(formData, 'reparticion'),
		otraReparticion: getValue(formData, 'otraReparticion'),
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
			<button class="modal-action-button" type="button">Listo</button>
		</div>
	`;
	document.body.appendChild(modal);
	modal.querySelector('button')?.addEventListener('click', () => {
		window.location.href = '/';
	});
}

function showMessageModal({ title, message, detail }) {
	const modal = document.createElement('div');
	modal.className = 'success-modal';
	modal.innerHTML = `
		<div class="success-modal-card" role="dialog" aria-modal="true" aria-labelledby="message-title">
			<div class="success-modal-icon is-warning" aria-hidden="true">!</div>
			<h2 id="message-title">${title}</h2>
			<p>${message}</p>
			${detail ? `<small>${detail}</small>` : ''}
			<button class="modal-action-button" type="button">Aceptar</button>
		</div>
	`;
	document.body.appendChild(modal);
	modal.querySelector('button')?.addEventListener('click', () => modal.remove());
}

function showTimedModal({ title, message, detail, type = 'success', timeout = 1800 }) {
	const modal = document.createElement('div');
	modal.className = 'success-modal timed-modal';
	modal.innerHTML = `
		<div class="success-modal-card" role="status" aria-live="polite">
			<div class="success-modal-icon ${type === 'warning' ? 'is-warning' : ''}" aria-hidden="true">${type === 'warning' ? '!' : '✓'}</div>
			<h2>${title}</h2>
			<p>${message}</p>
			${detail ? `<small>${detail}</small>` : ''}
		</div>
	`;
	document.body.appendChild(modal);
	window.setTimeout(() => modal.remove(), timeout);
}

function showLoadingModal(message) {
	const modal = document.createElement('div');
	modal.className = 'success-modal loading-modal';
	modal.innerHTML = `
		<div class="success-modal-card" role="status" aria-live="polite">
			<div class="loading-spinner" aria-hidden="true"></div>
			<h2>Enviando denuncia</h2>
			<p>${message}</p>
			<small>No cierres ni actualices la página.</small>
		</div>
	`;
	document.body.classList.add('is-submitting');
	document.body.appendChild(modal);
	return modal;
}

function closeLoadingModal(modal) {
	modal?.remove();
	document.body.classList.remove('is-submitting');
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
	const fileInput = form.elements.denunciaArchivos;
	const fileDropzone = form.querySelector('.file-dropzone');
	const fileList = form.querySelector('[data-file-list]');
	const reparticionSelect = form.elements.reparticion;
	const otraReparticionField = form.querySelector('[data-reparticion-other]');
	const otraReparticionInput = form.elements.otraReparticion;

	function renderFileList(files) {
		fileDropzone?.classList.toggle('has-files', files.length > 0);

		if (!fileList) return;

		if (files.length === 0) {
			fileList.innerHTML = '';
			return;
		}

		fileList.innerHTML = `
			<strong>${files.length === 1 ? 'Archivo cargado' : 'Archivos cargados'}</strong>
			<ul>
				${files
					.map(
						(file) => `
							<li>
								<span>${escapeHtml(file.name)}</span>
								<em>${formatBytes(file.size)}</em>
							</li>
						`,
					)
					.join('')}
			</ul>
		`;
	}

	function syncOtraReparticion() {
		const isOther = reparticionSelect.value === 'Otro';
		otraReparticionField?.classList.toggle('is-hidden', !isOther);
		otraReparticionInput.required = isOther;
		if (!isOther) {
			otraReparticionInput.value = '';
			setError('otraReparticion', '');
		}
	}

	reparticionSelect?.addEventListener('change', syncOtraReparticion);
	syncOtraReparticion();

	fileInput?.addEventListener('change', () => {
		const files = getFiles();
		const fileErrors = getFilesError(files);

		if (fileErrors) {
			fileInput.value = '';
			renderFileList([]);
			setError('denunciaArchivos', fileErrors);
			showMessageModal({
				title: 'Revisá el archivo',
				message: fileErrors,
				detail: `Formatos permitidos: PDF o imágenes. Máximo ${MAX_FILES} archivos, ${formatBytes(MAX_FILE_SIZE)} por archivo.`,
			});
			return;
		}

		renderFileList(files);
		setError('denunciaArchivos', '');
		showTimedModal({
			title: 'Archivo cargado',
			message: files.length === 1 ? 'La denuncia quedó adjuntada al formulario.' : 'Los archivos quedaron adjuntados al formulario.',
			detail: `${files.length} ${files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}.`,
		});
	});

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
			if (errors.denunciaArchivos) {
				showMessageModal({
					title: 'Revisá el archivo',
					message: errors.denunciaArchivos,
					detail: `Formatos permitidos: PDF o imágenes. Máximo ${MAX_FILES} archivos, ${formatBytes(MAX_FILE_SIZE)} por archivo.`,
				});
			}
			return;
		}

		if (APPS_SCRIPT_URL.includes('PEGAR_URL')) {
			statusMessage.textContent = 'Falta configurar la URL del Web App de Apps Script.';
			statusMessage.classList.add('is-error');
			return;
		}

		submitButton.disabled = true;
		submitButton.textContent = 'Enviando...';
		const loadingModal = showLoadingModal('Estamos cargando los archivos y registrando la denuncia.');

		try {
			const archivos = await Promise.all(files.map(fileToPayload));
			const result = await submitDenuncia({ ...payload, archivos });
			form.reset();
			renderFileList([]);
			closeLoadingModal(loadingModal);
			showSuccessModal({
				title: 'Denuncia enviada',
				message: 'Recibimos la documentación correctamente.',
				detail: `ID de denuncia: ${result.idDenuncia}`,
			});
		} catch (error) {
			closeLoadingModal(loadingModal);
			const message = error.message || 'Ocurrió un error al enviar la denuncia.';
			statusMessage.textContent = message;
			statusMessage.classList.add('is-error');
			showMessageModal({
				title: 'No se pudo enviar',
				message,
				detail: 'Revisá los archivos, tu conexión e intentá nuevamente.',
			});
		} finally {
			submitButton.disabled = false;
			submitButton.textContent = 'Enviar denuncia';
		}
	});
}

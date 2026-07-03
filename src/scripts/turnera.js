import { APPS_SCRIPT_URL } from './config.js';

const AVAILABLE_TIMES = new Set([
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
]);

const form = document.querySelector('#turno-form');
const submitButton = document.querySelector('#submit-button');
const statusMessage = document.querySelector('#form-status');

const requiredMessages = {
	nombre: 'Ingresá tu nombre y apellido.',
	correo: 'Ingresá un correo válido.',
	cuil: 'Ingresá un CUIL/CUIT con 11 números.',
	tipoSolicitud: 'Seleccioná el tipo de solicitud.',
	equipo: 'Seleccioná el equipo involucrado.',
	fechaTurno: 'Seleccioná una fecha hábil desde hoy en adelante.',
	horaTurno: 'Seleccioná un horario disponible.',
};

function todayIsoDate() {
	const today = new Date();
	today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
	return today.toISOString().slice(0, 10);
}

function getValue(formData, key) {
	return String(formData.get(key) || '').trim();
}

function isBusinessDay(value) {
	if (!value) return false;
	const date = new Date(`${value}T12:00:00`);
	const day = date.getDay();
	return day >= 1 && day <= 5;
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
}

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasMinWords(value) {
	return value.trim().split(/\s+/).filter(Boolean).length >= 2;
}

function validate(payload) {
	const errors = {};
	const cuilNumbers = payload.cuil.replace(/\D/g, '');

	Object.entries(requiredMessages).forEach(([fieldName, message]) => {
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

	if (payload.fechaTurno && payload.fechaTurno < todayIsoDate()) {
		errors.fechaTurno = 'La fecha no puede ser anterior a hoy.';
	}

	if (payload.fechaTurno && !isBusinessDay(payload.fechaTurno)) {
		errors.fechaTurno = 'Seleccioná un día hábil, de lunes a viernes.';
	}

	if (payload.horaTurno && !AVAILABLE_TIMES.has(payload.horaTurno)) {
		errors.horaTurno = 'Seleccioná un horario disponible.';
	}

	return errors;
}

function payloadFromForm() {
	const formData = new FormData(form);

	return {
		nombre: getValue(formData, 'nombre'),
		correo: getValue(formData, 'correo'),
		cuil: getValue(formData, 'cuil'),
		tipoSolicitud: getValue(formData, 'tipoSolicitud'),
		equipo: getValue(formData, 'equipo'),
		descripcion: getValue(formData, 'descripcion'),
		fechaTurno: getValue(formData, 'fechaTurno'),
		horaTurno: getValue(formData, 'horaTurno'),
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

function showLoadingModal(message) {
	const modal = document.createElement('div');
	modal.className = 'success-modal loading-modal';
	modal.innerHTML = `
		<div class="success-modal-card" role="status" aria-live="polite">
			<div class="loading-spinner" aria-hidden="true"></div>
			<h2>Enviando solicitud</h2>
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

async function submitTurno(payload) {
	const response = await fetch(APPS_SCRIPT_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain;charset=utf-8',
		},
		body: JSON.stringify(payload),
	});

	const result = await response.json();

	if (!response.ok || !result.ok) {
		throw new Error(result.error || 'No se pudo confirmar el turno.');
	}

	return result;
}

if (form) {
	form.elements.fechaTurno.min = todayIsoDate();

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		clearErrors();
		statusMessage.textContent = '';
		statusMessage.className = 'form-status';

		const payload = payloadFromForm();
		const errors = validate(payload);

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
		const loadingModal = showLoadingModal('Estamos registrando el turno, creando el evento y enviando la confirmación.');

		try {
			const result = await submitTurno(payload);
			form.reset();
			closeLoadingModal(loadingModal);
			showSuccessModal({
				title: 'Turno confirmado',
				message: 'Tu solicitud fue registrada correctamente.',
				detail: `Ticket: ${result.idTurno}`,
			});
		} catch (error) {
			closeLoadingModal(loadingModal);
			const message = error.message || 'Ocurrió un error al enviar la solicitud.';
			statusMessage.textContent = message;
			statusMessage.classList.add('is-error');
			showMessageModal({
				title: 'No se pudo enviar',
				message,
				detail: 'Revisá tu conexión e intentá nuevamente.',
			});
		} finally {
			submitButton.disabled = false;
			submitButton.textContent = 'Confirmar turno';
		}
	});
}

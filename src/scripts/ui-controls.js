const enhancedSelects = new Set();
const enhancedDateInputs = new Set();
const enhancedFileInputs = new Set();

const CHEVRON_ICON = `
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M7.22 9.47a.75.75 0 0 1 1.06 0L12 13.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 0-1.06Z"></path>
	</svg>
`;

const CALENDAR_ICON = `
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M7.75 2.75a.75.75 0 0 1 .75.75V5h7V3.5a.75.75 0 0 1 1.5 0V5h1.25A2.75 2.75 0 0 1 21 7.75v10.5A2.75 2.75 0 0 1 18.25 21H5.75A2.75 2.75 0 0 1 3 18.25V7.75A2.75 2.75 0 0 1 5.75 5H7V3.5a.75.75 0 0 1 .75-.75ZM4.5 10v8.25c0 .69.56 1.25 1.25 1.25h12.5c.69 0 1.25-.56 1.25-1.25V10h-15Zm1.25-3.5c-.69 0-1.25.56-1.25 1.25V8.5h15v-.75c0-.69-.56-1.25-1.25-1.25H17V7a.75.75 0 0 1-1.5 0v-.5h-7V7A.75.75 0 0 1 7 7v-.5H5.75Z"></path>
	</svg>
`;

function closeAllSelects(except) {
	document.querySelectorAll('.custom-select.is-open').forEach((select) => {
		if (select !== except) {
			select.classList.remove('is-open');
			select.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
		}
	});
}

function enhanceSelect(select) {
	if (enhancedSelects.has(select)) return;
	enhancedSelects.add(select);

	const wrapper = document.createElement('div');
	wrapper.className = 'custom-select';

	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'custom-select-trigger';
	trigger.setAttribute('aria-haspopup', 'listbox');
	trigger.setAttribute('aria-expanded', 'false');

	const value = document.createElement('span');
	value.className = 'custom-select-value';

	const icon = document.createElement('span');
	icon.className = 'custom-select-icon';
	icon.setAttribute('aria-hidden', 'true');
	icon.innerHTML = CHEVRON_ICON;

	const list = document.createElement('div');
	list.className = 'custom-select-list';
	list.setAttribute('role', 'listbox');

	function syncValue() {
		const selectedOption = select.options[select.selectedIndex];
		value.textContent = selectedOption?.textContent || 'Seleccionar';
		wrapper.dataset.value = select.value;
	}

	function renderOptions() {
		list.innerHTML = '';

		Array.from(select.options).forEach((option) => {
			const item = document.createElement('button');
			item.type = 'button';
			item.className = 'custom-select-option';
			item.textContent = option.textContent;
			item.dataset.value = option.value;
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', String(option.selected));

			item.addEventListener('click', () => {
				select.value = option.value;
				select.dispatchEvent(new Event('change', { bubbles: true }));
				syncValue();
				renderOptions();
				closeAllSelects();
			});

			list.appendChild(item);
		});
	}

	trigger.append(value, icon);
	wrapper.append(trigger, list);
	select.classList.add('native-control-hidden');
	select.insertAdjacentElement('afterend', wrapper);

	trigger.addEventListener('click', () => {
		const willOpen = !wrapper.classList.contains('is-open');
		closeAllSelects(wrapper);
		wrapper.classList.toggle('is-open', willOpen);
		trigger.setAttribute('aria-expanded', String(willOpen));
	});

	trigger.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') closeAllSelects();
	});

	select.addEventListener('change', () => {
		syncValue();
		renderOptions();
	});

	syncValue();
	renderOptions();
}

function isoDate(date) {
	const copy = new Date(date);
	copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
	return copy.toISOString().slice(0, 10);
}

function isBusinessDay(date) {
	const day = date.getDay();
	return day >= 1 && day <= 5;
}

function formatDateLabel(value) {
	if (!value) return 'Seleccionar fecha';
	const [year, month, day] = value.split('-');
	return `${day}/${month}/${year}`;
}

function enhanceDateInput(input) {
	if (enhancedDateInputs.has(input)) return;
	enhancedDateInputs.add(input);
	input.dataset.enhancedDate = 'true';

	if (!input.min) {
		input.min = isoDate(new Date());
	}

	const wrapper = document.createElement('div');
	wrapper.className = 'date-picker';

	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'date-picker-trigger';
	trigger.setAttribute('aria-expanded', 'false');

	const value = document.createElement('span');
	value.className = 'date-picker-value';
	value.textContent = formatDateLabel(input.value);

	const icon = document.createElement('span');
	icon.className = 'date-picker-icon';
	icon.setAttribute('aria-hidden', 'true');
	icon.innerHTML = CALENDAR_ICON;

	const panel = document.createElement('div');
	panel.className = 'date-picker-panel';

	let viewDate = input.value ? new Date(`${input.value}T12:00:00`) : new Date();
	const minDate = input.min ? new Date(`${input.min}T00:00:00`) : null;

	function renderCalendar() {
		const year = viewDate.getFullYear();
		const month = viewDate.getMonth();
		const monthStart = new Date(year, month, 1);
		const firstDay = monthStart.getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const selectedValue = input.value;

		panel.innerHTML = '';

		const header = document.createElement('div');
		header.className = 'date-picker-header';

		const prev = document.createElement('button');
		prev.type = 'button';
		prev.textContent = '<';
		prev.setAttribute('aria-label', 'Mes anterior');

		const title = document.createElement('strong');
		title.textContent = viewDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

		const next = document.createElement('button');
		next.type = 'button';
		next.textContent = '>';
		next.setAttribute('aria-label', 'Mes siguiente');

		prev.addEventListener('click', () => {
			viewDate = new Date(year, month - 1, 1);
			renderCalendar();
		});

		next.addEventListener('click', () => {
			viewDate = new Date(year, month + 1, 1);
			renderCalendar();
		});

		header.append(prev, title, next);
		panel.appendChild(header);

		const week = document.createElement('div');
		week.className = 'date-picker-week';
		['D', 'L', 'M', 'M', 'J', 'V', 'S'].forEach((day) => {
			const label = document.createElement('span');
			label.textContent = day;
			week.appendChild(label);
		});
		panel.appendChild(week);

		const grid = document.createElement('div');
		grid.className = 'date-picker-grid';

		for (let i = 0; i < firstDay; i += 1) {
			grid.appendChild(document.createElement('span'));
		}

		for (let day = 1; day <= daysInMonth; day += 1) {
			const date = new Date(year, month, day, 12);
			const valueIso = isoDate(date);
			const cell = document.createElement('button');
			cell.type = 'button';
			cell.textContent = String(day);
			cell.className = 'date-picker-day';

			if (selectedValue === valueIso) cell.classList.add('is-selected');

			if ((minDate && date < minDate) || !isBusinessDay(date)) {
				cell.disabled = true;
			}

			cell.addEventListener('click', () => {
				input.value = valueIso;
				input.dispatchEvent(new Event('change', { bubbles: true }));
				value.textContent = formatDateLabel(valueIso);
				wrapper.classList.remove('is-open');
				trigger.setAttribute('aria-expanded', 'false');
				renderCalendar();
			});

			grid.appendChild(cell);
		}

		panel.appendChild(grid);
	}

	trigger.append(value, icon);
	wrapper.append(trigger, panel);
	input.classList.add('native-control-hidden');
	input.insertAdjacentElement('afterend', wrapper);

	trigger.addEventListener('click', () => {
		const willOpen = !wrapper.classList.contains('is-open');
		document.querySelectorAll('.date-picker.is-open').forEach((picker) => {
			if (picker !== wrapper) picker.classList.remove('is-open');
		});
		wrapper.classList.toggle('is-open', willOpen);
		trigger.setAttribute('aria-expanded', String(willOpen));
	});

	input.addEventListener('change', () => {
		value.textContent = formatDateLabel(input.value);
		if (input.value) viewDate = new Date(`${input.value}T12:00:00`);
		renderCalendar();
	});

	renderCalendar();
}

function enhanceFileInput(input) {
	if (enhancedFileInputs.has(input)) return;
	enhancedFileInputs.add(input);
	input.dataset.enhancedFile = 'true';

	const field = input.closest('.file-field');
	const summary = field?.querySelector('[data-error-for="denunciaArchivos"]');
	const dropzone = field?.querySelector('.file-dropzone');

	function updateSummary() {
		const files = Array.from(input.files || []);
		if (!summary) return;

		if (files.length === 0) {
			summary.textContent = 'No hay archivos seleccionados.';
			dropzone?.classList.remove('has-files');
			return;
		}

		const names = files.map((file) => file.name).join(', ');
		summary.textContent = `${files.length} archivo${files.length > 1 ? 's' : ''}: ${names}`;
		dropzone?.classList.add('has-files');
	}

	input.addEventListener('change', updateSummary);
	input.addEventListener('input', updateSummary);
	updateSummary();
}

function initUiControls() {
	document.querySelectorAll('select').forEach(enhanceSelect);
	document.querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
	document.querySelectorAll('input[type="file"]').forEach(enhanceFileInput);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initUiControls, { once: true });
} else {
	initUiControls();
}

document.addEventListener('click', (event) => {
	if (!event.target.closest('.custom-select')) closeAllSelects();

	if (!event.target.closest('.date-picker')) {
		document.querySelectorAll('.date-picker.is-open').forEach((picker) => {
			picker.classList.remove('is-open');
			picker.querySelector('.date-picker-trigger')?.setAttribute('aria-expanded', 'false');
		});
	}
});

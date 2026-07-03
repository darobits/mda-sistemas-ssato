const enhancedSelects = new Set();

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
	icon.textContent = 'v';

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
	if (input.dataset.enhancedDate === 'true') return;
	input.dataset.enhancedDate = 'true';

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
	icon.textContent = 'cal';

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
	if (input.dataset.enhancedFile === 'true') return;
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

	dropzone?.addEventListener('click', () => input.click());
	input.addEventListener('change', updateSummary);
	updateSummary();
}

document.querySelectorAll('select').forEach(enhanceSelect);
document.querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
document.querySelectorAll('input[type="file"]').forEach(enhanceFileInput);

document.addEventListener('click', (event) => {
	if (!event.target.closest('.custom-select')) closeAllSelects();

	if (!event.target.closest('.date-picker')) {
		document.querySelectorAll('.date-picker.is-open').forEach((picker) => {
			picker.classList.remove('is-open');
			picker.querySelector('.date-picker-trigger')?.setAttribute('aria-expanded', 'false');
		});
	}
});

// berde. — app de gastos personales, hecha con HTML, CSS y JS puro (sin servidor ni librerías, salvo jsPDF para el informe).
// Los datos se guardan en el navegador (localStorage) y se separan por moneda: cada moneda es como una cuenta aparte.
// index.html tiene la estructura, styles.css el diseño y este archivo todo el comportamiento.
//
// Índice (buscá el nombre tal cual con Ctrl+F para ir a la sección):
//   configuracion                   versión, formulario de reporte, monedas, categorías, palabras clave
//   categorias                      orden de las categorías y altas o bajas en la lista
//   utilidades                      formateo de montos y fechas, filtro de emojis, montos pegados
//   estado y guardado               state, load, persist, migración de datos viejos, gastos de la moneda activa
//   deteccion de categoria          adivina la categoría por la descripción
//   periodo                         día, mes o año que se está viendo y su título
//   calendario                      selector de fecha que se abre con el segundo toque en Día, Mes o Año
//   animaciones                     contadores, deslizar bloques, menús desplegables
//   dialogos                        abrir y cerrar hojas, pantalla de atrás inerte, foco
//   pantalla principal              renderMain: total, categorías, filtro y últimos gastos
//   presupuesto                     bloque "Te quedan…", barra y hoja del presupuesto
//   hoja del informe                elegir qué entra en el informe
//   informe pdf                     arma y descarga el PDF
//   menu de cuenta                  menú que se abre tocando el saludo
//   moneda                          cambiar la moneda activa
//   respaldo (exportar e importar)  descargar y cargar el archivo de respaldo
//   cerrar sesion y borrar datos    opciones del final del menu de cuenta
//   hoja del gasto                  agregar o editar un gasto, fecha del gasto
//   avisos                          cartelito de abajo (toast)
//   hoja de categoria               crear o editar una categoria personalizada
//   eliminar categoria              confirmar y borrar una categoría
//   reordenar categorias            mantener apretado y arrastrar
//   eventos                         todos los clics (data-action) y teclas
//   ingreso                         pantalla de iniciar sesión o registrarse
//   cambio de dia                   si la app queda abierta pasada la medianoche
//   arranque                        lo que corre al abrir la app
(function () {
  'use strict';

  /* ---------- configuracion ---------- */
  // Valores que se tocan a mano. STORAGE_KEY no se cambia: si cambia, se pierden los datos guardados.
  const STORAGE_KEY = 'gastos.v1';
  const APP_VERSION = '0.3'; // se muestra en el menu de cuenta y va al formulario de reporte; subirla en cada versión
  // Reportar un problema: link al Google Form y los campos que llegan ya completos.
  // Si se cambia el formulario, los entry salen de "Obtener enlace prefijado" en Google Forms.
  const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdd_EJ_7bNoIu-0-kSz_Ol8xkJIx-GL5toWHR7iw97lyV1lVg/viewform';
  const FEEDBACK_ENTRY_VERSION = 'entry.730695879'; // campo de la versión
  const FEEDBACK_ENTRY_DEVICE = 'entry.834530593';  // campo del dispositivo
  // Monedas que se pueden elegir (en este orden aparecen en la hoja de moneda). Para sumar una, agregar una línea.
  // plural va en minúscula y se usa en frases como "Todavía no hay gastos en dólares este mes".
  // Nunca se convierten entre sí: cada moneda tiene sus propios gastos y presupuesto.
  const CURRENCIES = {
    ARS: { symbol: '$', label: 'Peso argentino', plural: 'pesos argentinos' },
    USD: { symbol: 'US$', label: 'Dólar', plural: 'dólares' },
    EUR: { symbol: '€', label: 'Euro', plural: 'euros' },
    BRL: { symbol: 'R$', label: 'Real', plural: 'reales' },
    CLP: { symbol: '$', label: 'Peso chileno', plural: 'pesos chilenos' },
    COP: { symbol: '$', label: 'Peso colombiano', plural: 'pesos colombianos' },
    MXN: { symbol: '$', label: 'Peso mexicano', plural: 'pesos mexicanos' },
    PEN: { symbol: 'S/', label: 'Sol', plural: 'soles' },
    UYU: { symbol: '$', label: 'Peso uruguayo', plural: 'pesos uruguayos' },
    GBP: { symbol: '£', label: 'Libra', plural: 'libras' }
  };
  // true solo si es una de las monedas de arriba (hasOwnProperty para que 'constructor' no cuente)
  const isCurrency = (code) => typeof code === 'string' && Object.prototype.hasOwnProperty.call(CURRENCIES, code);

  // Categorías que trae la app. d es el dibujo del ícono (path de SVG). "otros" no se puede borrar: recibe los gastos huérfanos.
  const CATS = [
    { id: 'comida', name: 'Comida', d: 'M6 3v5a3 3 0 0 0 6 0V3M9 3v5M9 11v10M18 21V3c-1.8 1.2-3 4-3 8v2h3' },
    { id: 'compras', name: 'Compras', d: 'M5 8h14l-1 12H6L5 8zM9 8V7a3 3 0 0 1 6 0v1' },
    { id: 'transporte', name: 'Transporte', d: 'M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM4 11h16M12 3v8M8.5 14.5h.01M15.5 14.5h.01M8 18l-2 3M16 18l2 3' },
    { id: 'hogar', name: 'Hogar', d: 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-5h4v5' },
    { id: 'suscripciones', name: 'Suscripciones', d: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4' },
    { id: 'entretenimiento', name: 'Entretenimiento', d: 'M3 6h18v12H3zM10 9.5v5l4.5-2.5z' },
    { id: 'otros', name: 'Otros', d: 'M5.5 12h.01M12 12h.01M18.5 12h.01' }
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const DEFAULT_IDS = CATS.map((c) => c.id); // se guarda antes de que el usuario cambie nada, para validar respaldos

  // Palabras clave para adivinar la categoría al escribir la descripción (sin tildes y en minúscula)
  const KEYWORDS = {
    comida: ['pizza', 'almuerzo', 'cena', 'cafe', 'desayuno', 'helado', 'verduleria', 'panaderia', 'restaurante', 'sushi', 'empanada', 'hamburguesa', 'rotiseria', 'delivery', 'comida', 'merienda'],
    compras: ['supermercado', 'super', 'ropa', 'zapatilla', 'libro', 'regalo', 'shopping', 'compras'],
    transporte: ['uber', 'taxi', 'nafta', 'sube', 'colectivo', 'subte', 'tren', 'peaje', 'cabify', 'estacionamiento'],
    hogar: ['electricidad', 'luz', 'gas', 'agua', 'internet', 'alquiler', 'expensas', 'limpieza'],
    suscripciones: ['netflix', 'spotify', 'disney', 'youtube', 'icloud', 'suscripcion', 'hbo', 'prime'],
    entretenimiento: ['cine', 'teatro', 'entradas', 'recital', 'concierto', 'juego', 'museo']
  };

  // Nombres de los meses para títulos y fechas
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MONTHS_LONG_LOWER = MONTHS.map((m) => m.toLowerCase());
  const MONTHS_SHORT = MONTHS_LONG_LOWER.map((m) => m.slice(0, 3));

  /* ---------- categorias ---------- */
  // Orden de las categorías (lo elige el usuario arrastrando) y agregar o sacar categorías de la lista CATS.
  const applyOrder = () => {
    const rank = (id) => { const i = state.order.indexOf(id); return i < 0 ? 1e6 : i; };
    CATS.sort((a, b) => rank(a.id) - rank(b.id)); // sort estable: lo que no tiene lugar guardado queda donde estaba
  };
  function addCat(c) { CATS.push(c); CAT[c.id] = c; }
  function addCatOnTop(c) { CATS.unshift(c); CAT[c.id] = c; } // la categoria personalizada nueva aparece primera para que se vea
  function dropCat(id) { const i = CATS.findIndex((c) => c.id === id); if (i >= 0) CATS.splice(i, 1); delete CAT[id]; }
  // íconos del lápiz y el tacho que aparecen en la categoría seleccionada
  const PENCIL_ICON = 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3zM14 7l3 3';
  const TRASH_ICON = 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3';

  /* ---------- utilidades ---------- */
  // Funciones chicas que se usan en todos lados: $, esc (para no inyectar HTML), money, fechas, isValidDate, latin, parseAmount.
  const $ = (id) => document.getElementById(id);
  const icon = (d, size, sw) =>
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  const checkIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dots = (digits) => String(digits || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const money = (n) => CURRENCIES[state.currency].symbol + dots(String(Math.round(n))); // siempre con el símbolo de la moneda activa, sin decimales
  // para comparar textos sin importar mayúsculas ni tildes
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  // fechas como texto AAAA-MM-DD en hora local (así se comparan con < y >)
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toISO(d); };
  // id corto de letras y números (los ids se meten en el HTML, por eso nada raro)
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Fecha AAAA-MM-DD que existe de verdad (no "2026-13-45"), entre 2000 y 2100
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    if (y < 2000 || y > 2100) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  // Bloqueo de emojis: solo letras latinas (con tildes y ñ). Se hace porque el PDF usa Helvetica, que no
  // dibuja emojis, y porque los íconos de las categorías ya cumplen ese papel. Las comillas del celular
  // (’ “ ”) pasan a las comunes para que "O’Higgins" no pierda el apóstrofo.
  const NON_LATIN_RE = /[^\u0020-\u007E\u00A0-\u00FF]/g;
  const latin = (s) => String(s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(NON_LATIN_RE, '');
  // Quita los emojis mientras se escribe sin que el cursor salte al final
  function keepLatin(input) {
    const clean = latin(input.value);
    if (clean === input.value) return;
    const caret = latin(input.value.slice(0, input.selectionStart)).length;
    input.value = clean;
    input.setSelectionRange(caret, caret);
  }

  // Montos pegados: si terminan en coma o punto + 1 o 2 dígitos son centavos y se redondea
  // ("1.500,50" → 1501). Si no, solo los dígitos ("1.500" → 1500). Solo se usa al pegar, no al tipear.
  // 9 dígitos máximo, igual que al escribir.
  function parseAmount(text) {
    const str = String(text || '').trim();
    const cents = str.match(/[.,](\d{1,2})$/);
    let digits;
    if (cents) {
      const whole = str.slice(0, cents.index).replace(/\D/g, '').replace(/^0+/, '').slice(0, 12) || '0';
      digits = String(Math.round(Number(whole + '.' + cents[1])));
    } else {
      digits = str.replace(/\D/g, '');
    }
    return digits.replace(/^0+/, '').slice(0, 9);
  }

  // fecha corta para la lista de últimos gastos: "Hoy", "30 sep" o "30 sep 2025"
  function dayLabel(iso) {
    const today = daysAgo(0);
    if (iso === today) return 'Hoy';
    const label = Number(iso.slice(8, 10)) + ' ' + MONTHS_SHORT[Number(iso.slice(5, 7)) - 1];
    return iso.slice(0, 4) === today.slice(0, 4) ? label : label + ' ' + iso.slice(0, 4);
  }

  /* ---------- estado y guardado ---------- */
  // Todo lo que la app recuerda está en state. load lee lo guardado, persist lo guarda, activeExpenses da los gastos de la moneda activa.
  const state = {
    period: 'mes', cat: 'all', filterOpen: false, showAll: false,
    ref: daysAgo(0),        // fecha que se está viendo (de ahí sale el día, mes o año)
    pickOpen: false,        // calendario del período abierto
    view: { y: 0, m: 0 },   // mes o año que muestra el calendario mientras se navega con las flechas
    expenses: [], learned: {}, customCats: [], renames: {}, order: [],
    deleted: [],            // categorías predeterminadas que el usuario eliminó
    icons: {},              // íconos cambiados de categorías predeterminadas
    budgets: {},            // presupuestos puntuales por moneda y mes: { 'ARS': { 'AAAA-MM': monto } }
    budgetDefault: {},      // presupuesto que se repite todos los meses, por moneda: { 'ARS': monto } (sin entrada = no hay)
    currency: 'ARS',        // cuenta activa: se ve, se carga y se descarga solo lo de esta moneda (nunca se convierte)
    accOpen: false,         // menú de cuenta abierto
    report: { scope: 'all', cats: {} }, // hoja del informe: todo o por categorías, y cuáles
    sheet: null,            // hoja del gasto abierta: null, 'new' o 'edit'
    // lo que se está escribiendo en la hoja del gasto, antes de guardar
    draft: { id: null, digits: '', desc: '', manualCat: null, date: null, pickerOpen: false }
  };

  // Carga lo guardado en el navegador. Si no hay nada, la app arranca vacía.
  // Lo guardado se revisa igual que un respaldo (cleanData): alguien pudo editarlo a mano y los ids e íconos
  // terminan dentro del HTML. Si no se puede leer, se arranca vacío en memoria sin borrar lo guardado.
  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return; } // sin almacenamiento o JSON roto
    const data = cleanData(raw, false);
    if (!data) return;
    // Migración: datos de antes de separar por moneda (gastos sin moneda o presupuestos sin agrupar)
    const migrated = raw.expenses.some((e) => !isObj(e) || !isCurrency(e.cur)) || budgetsByCurrency(raw.budgets, raw.budgetDefault, data.currency).migrated;
    state.currency = data.currency;
    state.expenses = data.expenses;
    state.budgets = data.budgets;
    state.budgetDefault = data.budgetDefault;
    state.learned = data.learned;
    state.customCats = data.customCats;
    state.customCats.forEach(addCat);
    state.order = data.order;
    state.renames = data.renames;
    Object.keys(state.renames).forEach((id) => { if (CAT[id]) CAT[id].name = state.renames[id]; });
    state.icons = data.icons;
    Object.keys(state.icons).forEach((id) => { if (CAT[id]) CAT[id].d = state.icons[id]; });
    state.deleted = data.deleted;
    state.deleted.forEach(dropCat);
    applyOrder();
    if (migrated) persist(); // se guarda migrado para no hacerlo cada vez
  }
  // Ordena los presupuestos por moneda. Si vienen en el formato viejo (sin moneda) los pone bajo cur.
  // Tira lo que no tenga la forma esperada. Se usa al cargar y al importar un respaldo.
  const MONTH_RE = /^\d{4}-\d{2}$/;
  function budgetsByCurrency(rawBudgets, rawDefault, cur) {
    const budgets = {}, defaults = {};
    let migrated = false;
    if (isObj(rawBudgets)) {
      const flat = Object.keys(rawBudgets).some((k) => MONTH_RE.test(k));
      if (flat) migrated = true;
      const groups = flat ? { [cur]: rawBudgets } : rawBudgets;
      Object.keys(groups).forEach((code) => {
        if (!isCurrency(code) || !isObj(groups[code])) return;
        const months = {};
        Object.keys(groups[code]).forEach((k) => { if (MONTH_RE.test(k) && isAmount(groups[code][k])) months[k] = groups[code][k]; });
        if (Object.keys(months).length) budgets[code] = months;
      });
    }
    if (typeof rawDefault === 'number') { migrated = true; if (isAmount(rawDefault)) defaults[cur] = rawDefault; }
    else if (isObj(rawDefault)) Object.keys(rawDefault).forEach((code) => { if (isCurrency(code) && isAmount(rawDefault[code])) defaults[code] = rawDefault[code]; });
    return { budgets: budgets, defaults: defaults, migrated: migrated };
  }

  // Lo que se guarda. Es lo mismo que va en el respaldo al exportar.
  function snapshot() {
    return { expenses: state.expenses, learned: state.learned, customCats: state.customCats, renames: state.renames, icons: state.icons, deleted: state.deleted, budgets: state.budgets, budgetDefault: state.budgetDefault, currency: state.currency, order: CATS.map((c) => c.id) };
  }
  // guarda todo; se llama después de cada cambio
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); } catch (e) { /* ignorar */ }
  }

  // Gastos de la moneda activa. Todo lo que se muestra o se descarga sale de acá, para no mezclar monedas.
  // Editar, borrar o mover gastos de categoría sí trabaja sobre state.expenses completo.
  const activeExpenses = () => state.expenses.filter((e) => e.cur === state.currency);

  /* ---------- deteccion de categoria ---------- */
  // detect sugiere la categoría según lo que se escribe en la descripción. Orden: lo que el usuario corrigió antes,
  // el nombre de una categoria personalizada y por último las palabras clave.
  function detect(desc) {
    const n = norm(desc);
    if (!n) return 'otros';
    if (CAT[state.learned[n]]) return state.learned[n]; // aprendido de una corrección anterior
    for (const c of state.customCats) { const cn = norm(c.name); if (cn && n.includes(cn)) return c.id; } // categoria personalizada
    for (const id of Object.keys(KEYWORDS)) {
      if (CAT[id] && KEYWORDS[id].some((w) => n.includes(w))) return id; // CAT[id] falla si el usuario la eliminó
    }
    return 'otros';
  }

  /* ---------- periodo ---------- */
  // Qué día, mes o año se está viendo. state.ref es la fecha elegida y según el período se mira su día, su mes o su año.
  // true si el gasto cae en lo que se está viendo
  function inPeriod(e) {
    const r = state.ref;
    if (state.period === 'dia') return e.date === r;
    if (state.period === 'mes') return e.date.slice(0, 7) === r.slice(0, 7);
    return e.date.slice(0, 4) === r.slice(0, 4);
  }

  // Para el mensaje de lista vacía: "hoy", "este mes", "este año" o la fecha que se está viendo
  function periodPhrase() {
    const r = state.ref, today = daysAgo(0);
    const y = r.slice(0, 4) === today.slice(0, 4) ? '' : ' de ' + r.slice(0, 4);
    if (state.period === 'dia') return r === today ? 'hoy' : 'el ' + Number(r.slice(8, 10)) + ' de ' + MONTHS_LONG_LOWER[Number(r.slice(5, 7)) - 1] + y;
    if (state.period === 'mes') return r.slice(0, 7) === today.slice(0, 7) ? 'este mes' : 'en ' + MONTHS[Number(r.slice(5, 7)) - 1] + y;
    return r.slice(0, 4) === today.slice(0, 4) ? 'este año' : 'en ' + r.slice(0, 4);
  }

  // Título de arriba: "Gastos de Octubre", "Gastos de hoy", etc.
  function headingText() {
    const r = state.ref;
    const y = Number(r.slice(0, 4));
    const m = Number(r.slice(5, 7)) - 1;
    const today = daysAgo(0);
    // lo actual va corto; cualquier otra fecha, completa con el año
    if (state.period === 'dia') {
      if (r === today) return 'Gastos de hoy';
      return 'Gastos del ' + Number(r.slice(8, 10)) + ' de ' + MONTHS_LONG_LOWER[m] + ' de ' + y;
    }
    if (state.period === 'mes') return 'Gastos de ' + MONTHS[m] + (r.slice(0, 7) === today.slice(0, 7) ? '' : ' de ' + y);
    return 'Gastos de ' + y;
  }

  /* ---------- calendario ---------- */
  // Se abre con el segundo toque en Día, Mes o Año. renderPicker dibuja días, meses o años; los puntitos marcan dónde hay gastos.
  const YEARS_PAGE = 9; // años por página: entran justo en la grilla de 3 x 3
  const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Abre el calendario parado en la fecha que se está viendo
  function openPeriodPicker() {
    const y = Number(state.ref.slice(0, 4));
    const ty = new Date().getFullYear();
    state.view = { y: state.period === 'anio' ? ty - Math.floor((ty - y) / YEARS_PAGE) * YEARS_PAGE : y, m: Number(state.ref.slice(5, 7)) - 1 };
    state.pickOpen = true;
  }

  // Flechas del calendario: un mes (en Día), un año (en Mes) o una página de años (en Año)
  function navPicker(dir) {
    const v = state.view;
    if (state.period === 'dia') {
      v.m += dir;
      if (v.m < 0) { v.m = 11; v.y--; } else if (v.m > 11) { v.m = 0; v.y++; }
    } else {
      v.y += dir * (state.period === 'anio' ? YEARS_PAGE : 1);
    }
  }

  // Dibuja el calendario. Lo futuro queda deshabilitado porque no se cargan gastos a futuro.
  function renderPicker() {
    const box = $('periodPicker');
    box.hidden = !state.pickOpen;
    document.querySelectorAll('[data-period]').forEach((b) => b.setAttribute('aria-expanded', b.classList.contains('on') && state.pickOpen));
    if (!state.pickOpen) return;

    const today = daysAgo(0);
    const ty = Number(today.slice(0, 4));
    const tm = Number(today.slice(5, 7)) - 1;
    const v = state.view;
    const has = new Set();
    activeExpenses().forEach((e) => { has.add(e.date); has.add(e.date.slice(0, 7)); has.add(e.date.slice(0, 4)); }); // puntitos: solo la moneda activa
    const cell = (label, iso, key, on, future, extra) =>
      '<button class="cal-cell' + (on ? ' on' : '') + (extra || '') + (has.has(key) && !future ? ' dot' : '') + '" data-action="cal-pick" data-value="' + iso + '"' +
      (future ? ' disabled' : '') + (on ? ' aria-current="true"' : '') + '>' + label + '</button>';

    let title, grid, kind, atEnd, isCurrent;
    if (state.period === 'dia') {
      title = MONTHS[v.m] + ' ' + v.y;
      kind = 'cal-days';
      atEnd = v.y > ty || (v.y === ty && v.m >= tm);
      isCurrent = state.ref === today;
      const total = new Date(v.y, v.m + 1, 0).getDate(); // solo los días que tiene ese mes
      const offset = (new Date(v.y, v.m, 1).getDay() + 6) % 7; // la semana empieza el lunes
      grid = WEEKDAYS.map((d) => '<span class="cal-wd" aria-hidden="true">' + d + '</span>').join('') + '<span></span>'.repeat(offset);
      for (let d = 1; d <= total; d++) {
        const iso = v.y + '-' + pad(v.m + 1) + '-' + pad(d);
        grid += cell(d, iso, iso, iso === state.ref, iso > today, iso === today ? ' today' : '');
      }
    } else if (state.period === 'mes') {
      title = String(v.y);
      kind = 'cal-months';
      atEnd = v.y >= ty;
      isCurrent = state.ref.slice(0, 7) === today.slice(0, 7);
      grid = MONTHS_SHORT.map((name, i) => {
        const key = v.y + '-' + pad(i + 1);
        return cell(cap(name), key + '-01', key, key === state.ref.slice(0, 7), v.y > ty || (v.y === ty && i > tm), v.y === ty && i === tm ? ' today' : '');
      }).join('');
    } else {
      title = (v.y - YEARS_PAGE + 1) + ' – ' + v.y;
      kind = 'cal-years';
      atEnd = v.y >= ty;
      isCurrent = state.ref.slice(0, 4) === String(ty);
      grid = '';
      for (let y = v.y - YEARS_PAGE + 1; y <= v.y; y++) {
        grid += cell(y, y + '-01-01', String(y), String(y) === state.ref.slice(0, 4), y > ty, y === ty ? ' today' : '');
      }
    }

    const arrow = (dir, disabled) =>
      '<button class="cal-nav" data-action="cal-nav" data-dir="' + dir + '"' + (disabled ? ' disabled' : '') + ' aria-label="' + (dir < 0 ? 'Anterior' : 'Siguiente') + '">' +
      icon(dir < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6', 18, 2) + '</button>';
    const back = { dia: 'Volver a hoy', mes: 'Volver a este mes', anio: 'Volver a este año' }[state.period];

    box.innerHTML = '<div class="cal-head">' + arrow(-1, false) + '<span>' + title + '</span>' + arrow(1, atEnd) + '</div>' +
      '<div class="cal-grid ' + kind + '">' + grid + '</div>' +
      (isCurrent ? '' : '<button class="cal-today" data-action="cal-pick" data-value="' + today + '">' + back + '</button>');
  }

  /* ---------- animaciones ---------- */
  // Todo lo que se mueve: countTo (montos que corren), slide (abrir y cerrar bloques), toggleMenu, toggleRecent.
  // Si el sistema pide menos movimiento (reduceMotion), todo cambia de una.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const counters = {}; // por cada monto en pantalla: el valor que se ve ahora y su animación

  // Hace correr el número desde lo que se ve ahora hasta el nuevo monto
  function countTo(el, key, to, ms) {
    const c = counters[key] || (counters[key] = { val: to, raf: 0 });
    cancelAnimationFrame(c.raf);
    const from = c.val;
    if (from === to || reduceMotion.matches) { c.val = to; el.textContent = money(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / (ms || 380));
      c.val = from + (to - from) * (1 - Math.pow(1 - p, 4));
      el.textContent = money(c.val);
      if (p < 1) c.raf = requestAnimationFrame(step);
    };
    step(t0);
  }
  const shownVal = (key, fallback) => (counters[key] ? counters[key].val : fallback);

  // Repite la animación de aparecer (por ejemplo, el título al cambiar de período)
  function fadeIn(el) {
    el.classList.remove('swap');
    void el.offsetWidth;
    el.classList.add('swap');
  }

  const EASE = 'cubic-bezier(.2,.8,.2,1)';      // arranca rápido y frena suave
  const FLUID = 'cubic-bezier(.65,0,.35,1)'; // acelera y frena parejo, sin tirones

  // Abre o cierra un bloque estirando su alto, así lo de abajo baja o sube suave en vez de saltar.
  // El alto y el contenido se animan por separado. Duración entre 250 y 300 ms, como pidió el diseño.
  function slide(el, show) {
    const visible = !el.hidden && !el.dataset.closing;
    if (show === visible) return;
    // el padding también se anima: si no, el alto no baja de él y el bloque se traba antes de cerrar
    const pad = (cs) => [cs.paddingTop, cs.paddingBottom];
    const cs0 = getComputedStyle(el);
    const h0 = el.hidden ? 0 : el.offsetHeight;
    const o0 = el.hidden ? 0 : +cs0.opacity;
    const p0 = el.hidden ? ['0px', '0px'] : pad(cs0);
    el.getAnimations().forEach((a) => a.cancel());
    delete el.dataset.closing;
    el.hidden = false;
    const h1 = show ? el.offsetHeight : 0;
    const p1 = show ? pad(getComputedStyle(el)) : ['0px', '0px'];
    if (reduceMotion.matches || !el.offsetParent) { el.hidden = !show; return; } // sin animación si no se ve
    if (!show) el.dataset.closing = '1';
    const clip = { overflow: 'hidden' };
    const grow = el.animate([
      { height: h0 + 'px', paddingTop: p0[0], paddingBottom: p0[1], ...clip },
      { height: h1 + 'px', paddingTop: p1[0], paddingBottom: p1[1], ...clip },
    ],
      { duration: 300, easing: FLUID, fill: 'both' });
    el.animate(show
      ? [{ opacity: o0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }]
      : [{ opacity: o0, transform: 'none' }, { opacity: 0, transform: 'translateY(-4px)' }],
      { duration: show ? 260 : 250, delay: show ? 40 : 0, easing: show ? 'cubic-bezier(.25,.1,.25,1)' : 'cubic-bezier(.4,0,1,1)', fill: 'both' });
    grow.onfinish = () => {
      if (!show) el.hidden = true;
      delete el.dataset.closing;
      el.getAnimations().forEach((a) => a.cancel());
    };
  }

  // Cambia el texto de un botón con un fundido (por ejemplo "Definir presupuesto" → "Editar presupuesto")
  function swapLabel(btn, text) {
    if (btn.dataset.label === text) return; // ya va hacia ese texto: no reiniciar
    btn.dataset.label = text;
    btn.getAnimations().forEach((a) => a.cancel());
    if (btn.textContent === text) return;
    if (reduceMotion.matches) { btn.textContent = text; return; }
    const out = btn.animate([{ color: getComputedStyle(btn).color }, { color: 'transparent' }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
    out.onfinish = () => {
      btn.textContent = text;
      out.cancel();
      btn.animate([{ color: 'transparent' }, {}], { duration: 180, easing: 'ease-out' });
    };
  }

  // Mueve la pastilla blanca de los selectores (Día/Mes/Año, ingreso, informe) hasta el botón activo
  function placeThumb(group, instant) {
    const on = group.querySelector('button.on');
    if (!on || !on.offsetWidth) return; // oculto: no se puede medir
    let t = group.querySelector('.thumb');
    if (!t) {
      t = document.createElement('span');
      t.className = 'thumb';
      group.prepend(t);
      group.classList.add('has-thumb');
      instant = true;
    }
    if (instant) t.style.transition = 'none';
    t.style.width = on.offsetWidth + 'px';
    t.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    if (instant) { void t.offsetWidth; t.style.transition = ''; }
  }
  const placeAllThumbs = () => document.querySelectorAll('.segmented').forEach((g) => placeThumb(g, true));
  window.addEventListener('resize', placeAllThumbs);

  // Cambia el contenido de una tarjeta con el alto animado y las filas apareciendo de a una
  function swapContent(box, html, animate) {
    const h0 = box.offsetHeight;
    box.innerHTML = html;
    if (!animate || reduceMotion.matches) return;
    const h1 = box.offsetHeight;
    if (h0 !== h1) box.animate([{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }], { duration: 300, easing: EASE });
    Array.from(box.children).forEach((row, i) => row.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 260, delay: 40 + i * 35, easing: EASE, fill: 'backwards' }));
  }

  // "Ver todas" / "Ver menos" de últimos gastos, con la tarjeta estirándose suave
  let recentAnim = null;
  function toggleRecent() {
    const box = $('recent');
    if (recentAnim) {
      // se tocó de nuevo a mitad de animación: si se estaba plegando, queda desplegada
      const collapsing = recentAnim.collapsing;
      recentAnim.cancel(); recentAnim = null;
      box.querySelectorAll('.tx').forEach((row) => row.getAnimations().forEach((a) => a.cancel()));
      if (collapsing) return;
    }
    const h0 = box.offsetHeight;
    const clip = { overflow: 'hidden' };
    if (reduceMotion.matches) { state.showAll = !state.showAll; renderMain(); return; }
    if (!state.showAll) {
      state.showAll = true;
      renderMain();
      const h1 = box.offsetHeight;
      recentAnim = box.animate([{ height: h0 + 'px', ...clip }, { height: h1 + 'px', ...clip }], { duration: 380, easing: EASE });
      recentAnim.onfinish = () => { recentAnim = null; };
      Array.from(box.children).slice(4).forEach((row, i) => row.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, delay: 60 + i * 30, easing: EASE, fill: 'backwards' }));
    } else {
      // primero se encoge hasta la cuarta fila y recién al final se quitan las demás (si no, queda un hueco)
      const extra = Array.from(box.children).slice(4);
      if (!extra.length) { state.showAll = false; renderMain(); return; }
      const h1 = extra[0].getBoundingClientRect().top - box.getBoundingClientRect().top + parseFloat(getComputedStyle(box).paddingBottom) + 1;
      extra.forEach((row) => row.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }));
      recentAnim = box.animate([{ height: h0 + 'px', ...clip }, { height: h1 + 'px', ...clip }], { duration: 340, easing: EASE, fill: 'forwards' });
      recentAnim.collapsing = true;
      recentAnim.onfinish = () => {
        recentAnim = null;
        state.showAll = false;
        renderMain();
        box.getAnimations().forEach((a) => a.cancel());
      };
    }
  }

  // Si un menú no entra hasta abajo de la pantalla, se achica y se desplaza por dentro.
  // Hacía falta en computadora: la columna izquierda queda fija y el menú se cortaba sin borde de abajo.
  function fitMenu(menu) {
    menu.style.maxHeight = '';
    const room = window.innerHeight - menu.getBoundingClientRect().top - 16;
    if (menu.offsetHeight > room) menu.style.maxHeight = Math.max(180, room) + 'px';
  }
  window.addEventListener('resize', () => ['filterMenu', 'accMenu'].forEach((id) => { const m = $(id); if (!m.hidden) fitMenu(m); }));

  // Abre o cierra un menú desplegable (categorías o menu de cuenta) de arriba hacia abajo
  const MENU_SHUT = 'inset(0 -24px 100% -24px)', MENU_OPEN = 'inset(-4px -24px -32px -24px)'; // los negativos dejan ver la sombra
  function toggleMenu(menu, open) {
    const isOpen = !menu.hidden && !menu.dataset.closing;
    if (open === isOpen) return;
    menu.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    delete menu.dataset.closing;
    if (reduceMotion.matches) { menu.hidden = !open; if (open) fitMenu(menu); return; }
    const ease = 'cubic-bezier(.65,0,.35,1)';
    if (open) {
      menu.hidden = false;
      fitMenu(menu);
      menu.animate([
        { clipPath: MENU_SHUT, opacity: 0, transform: 'translateY(-4px)' },
        { clipPath: MENU_OPEN, opacity: 1, transform: 'none' },
      ], { duration: 300, easing: ease });
      Array.from(menu.children).forEach((item, i) => item.animate(
        [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 220, delay: 40 + i * 20, easing: 'ease-out', fill: 'backwards' }));
    } else {
      menu.dataset.closing = '1';
      const shut = menu.animate([
        { clipPath: MENU_OPEN, opacity: 1, transform: 'none' },
        { clipPath: MENU_SHUT, opacity: 0, transform: 'translateY(-4px)' },
      ], { duration: 250, easing: ease, fill: 'forwards' });
      shut.onfinish = () => { menu.hidden = true; delete menu.dataset.closing; shut.cancel(); };
    }
  }

  /* ---------- dialogos ---------- */
  // Abrir y cerrar hojas: showDialog y hideDialog. Con una hoja abierta, la pantalla de atrás queda inert
  // para que Tab no se escape detrás de la hoja. Al cerrarla, el foco vuelve al botón que la abrió.
  const DIALOGS = ['sheetRoot', 'catRoot', 'delRoot', 'budRoot', 'repRoot', 'impRoot', 'curRoot', 'wipeRoot'];
  const openers = {};
  let lastTrigger = null; // último botón tocado: Safari no le da foco a los botones al hacer clic, por eso se guarda acá
  function syncInert() { $('home').inert = DIALOGS.some((id) => !$(id).hidden); }
  function showDialog(id) {
    const t = lastTrigger || document.activeElement;
    openers[id] = t && t !== document.body ? { el: t, action: t.dataset && t.dataset.action, key: t.dataset && (t.dataset.id || t.dataset.cat) } : null;
    $(id).hidden = false;
    syncInert();
  }
  function hideDialog(id) {
    if ($(id).hidden) return;
    $(id).hidden = true;
    syncInert();
    const o = openers[id];
    openers[id] = null;
    if (!o) return;
    setTimeout(() => { // espera a que se redibuje la pantalla, si no el botón ya no existe
      let t = o.el;
      if (t.closest('#accMenu')) t = $('accBtn'); // lo abierto desde el menu de cuenta vuelve al saludo (el menú ya se cerró)
      else if (!t.isConnected && o.action) { // la lista se redibujó: se busca el botón equivalente
        const k = o.key ? CSS.escape(o.key) : '';
        t = document.querySelector('[data-action="' + o.action + '"]' + (k ? '[data-id="' + k + '"], [data-action="' + o.action + '"][data-cat="' + k + '"]' : ''));
      }
      if (t && t.isConnected && !t.closest('[inert]') && t.offsetParent !== null) t.focus({ preventScroll: true });
    }, 0);
  }

  /* ---------- pantalla principal ---------- */
  // renderMain dibuja todo: título, total, presupuesto, filtro de categorías, montos por categoría y últimos gastos.
  // Se llama después de cada cambio. catRowHTML arma una fila de categoría.
  function catRowHTML(c) {
    return '<div class="cat-item" data-cat="' + c.id + '">' +
      '<button class="cat-select" data-action="select-cat" data-cat="' + c.id + '"></button>' +
      '<div class="cat-icon">' + icon(c.d, 20) + '</div>' +
      '<div class="cat-name"><span></span>' +
      '<button class="pencil" data-action="edit-cat" data-cat="' + c.id + '">' + icon(PENCIL_ICON, 16, 1.8) + '</button>' +
      (c.id === 'otros' ? '' : '<button class="pencil trash" data-action="ask-delete-cat" data-cat="' + c.id + '">' + icon(TRASH_ICON, 16, 1.8) + '</button>') + '</div>' +
      '<div class="cat-amount">' + money(shownVal('cat:' + c.id, 0)) + '</div></div>';
  }

  // swap = true cuando cambia el período: el contenido aparece con animación
  function renderMain(swap) {
    const scoped = activeExpenses().filter(inPeriod);

    const sums = {};
    CATS.forEach((c) => { sums[c.id] = scoped.filter((e) => e.cat === c.id).reduce((t, e) => t + e.amount, 0); });
    const total = state.cat === 'all' ? CATS.reduce((t, c) => t + sums[c.id], 0) : sums[state.cat];

    $('heading').textContent = state.cat === 'all'
      ? headingText()
      : CAT[state.cat].name + ' · ' + headingText().replace(/^Gastos (de|del) /, '');
    countTo($('total'), 'total', total);
    if (swap) fadeIn($('heading'));
    renderBudget(state.period === 'mes' ? CATS.reduce((t, c) => t + sums[c.id], 0) : 0);

    document.querySelectorAll('[data-period]').forEach((b) => {
      const on = b.dataset.period === state.period;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    placeThumb($('periodGroup'));
    renderPicker();

    // Filtro de categorías (botón "Todas las categorías" y su menú)
    $('filterName').textContent = state.cat === 'all' ? 'Todas las categorías' : CAT[state.cat].name;
    $('filterBtn').setAttribute('aria-expanded', state.filterOpen);
    $('filterMenu').innerHTML = [{ id: 'all', name: 'Todas las categorías' }].concat(CATS).map((c) =>
      '<button data-action="pick-filter" data-cat="' + c.id + '"' + (state.cat === c.id ? ' class="on"' : '') + '>' +
      esc(c.name) + (state.cat === c.id ? checkIcon : '') + '</button>').join('');
    toggleMenu($('filterMenu'), state.filterOpen); // va después de armar las opciones para medir bien el alto
    $('accBtn').setAttribute('aria-expanded', state.accOpen);
    toggleMenu($('accMenu'), state.accOpen); // menu de cuenta

    // Montos por categoría: las filas se reusan (no se rearman) para que los montos y la selección animen
    let rows = Array.from($('cats').children);
    if (rows.length !== CATS.length || CATS.some((c, i) => rows[i].dataset.cat !== c.id)) {
      $('cats').innerHTML = CATS.map(catRowHTML).join('');
      rows = Array.from($('cats').children);
    }
    CATS.forEach((c, i) => {
      const row = rows[i];
      const sel = state.cat === c.id;
      row.classList.toggle('dim', state.cat !== 'all' && !sel);
      row.classList.toggle('sel', sel);
      const btn = row.querySelector('.cat-select');
      btn.setAttribute('aria-pressed', sel);
      btn.setAttribute('aria-label', 'Filtrar por ' + c.name);
      row.querySelector('.cat-name span').textContent = c.name;
      if (row.dataset.d !== c.d) { row.dataset.d = c.d; row.querySelector('.cat-icon').innerHTML = icon(c.d, 20); } // si se cambió el ícono
      row.querySelector('.pencil').setAttribute('aria-label', 'Editar ' + c.name);
      const trash = row.querySelector('.trash');
      if (trash) trash.setAttribute('aria-label', 'Eliminar ' + c.name);
      const amt = row.querySelector('.cat-amount');
      amt.classList.toggle('zero', sums[c.id] === 0);
      countTo(amt, 'cat:' + c.id, sums[c.id]);
    });

    // Últimos gastos (4 o todos con "Ver todas")
    const list = scoped
      .filter((e) => state.cat === 'all' || e.cat === state.cat)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // del más nuevo al más viejo; el mismo día, en orden de carga
    const shown = state.showAll ? list : list.slice(0, 4);
    swapContent($('recent'), shown.length
      ? shown.map((e) =>
          '<button class="tx" data-action="open-edit" data-id="' + e.id + '"><div>' +
          '<div class="tx-desc">' + esc(e.desc) + '</div>' +
          '<div class="tx-meta">' + dayLabel(e.date) + ' · ' + esc(CAT[e.cat].name) + '</div></div>' +
          '<div class="tx-amount">' + money(e.amount) + '</div></button>').join('')
      : '<div class="empty">Todavía no hay gastos en ' + esc(CURRENCIES[state.currency].plural) + ' ' + periodPhrase() + '.</div>', swap);
    const moreWasHidden = $('moreBtn').hidden;
    $('moreBtn').hidden = list.length <= 4;
    if (swap && moreWasHidden && !$('moreBtn').hidden) fadeIn($('moreBtn'));
    $('moreBtn').innerHTML = icon(state.showAll ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6', 16, 2) + (state.showAll ? 'Ver menos' : 'Ver todas');
  }

  /* ---------- presupuesto ---------- */
  // Presupuesto mensual de la moneda activa: el bloque "Te quedan $X de $Y" con su barra (renderBudget)
  // y la hoja del presupuesto (openBudget, saveBudget, removeBudget). Solo se muestra en la vista Mes con "Todas".
  // De qué mes es el presupuesto: el de la fecha elegida; en la vista Año, el mes actual o diciembre si es otro año.
  function budgetMonth() {
    const today = daysAgo(0);
    if (state.period !== 'anio') return state.ref.slice(0, 7);
    return state.ref.slice(0, 4) === today.slice(0, 4) ? today.slice(0, 7) : state.ref.slice(0, 4) + '-12';
  }
  // "Septiembre" o "Marzo de 2025" (el año solo si no es el actual)
  function monthName(key) {
    const name = MONTHS[Number(key.slice(5, 7)) - 1];
    return key.slice(0, 4) === daysAgo(0).slice(0, 4) ? name : name + ' de ' + key.slice(0, 4);
  }
  // Presupuesto de un mes en la moneda activa: el de ese mes solo; si no hay, el que se repite todos los meses.
  // Cada moneda tiene el suyo porque no se convierten: no tiene sentido comparar pesos con dólares.
  const monthBudget = (key) => (state.budgets[state.currency] || {})[key] || 0;
  const budgetFor = (key) => monthBudget(key) || state.budgetDefault[state.currency] || 0;

  // Dibuja el bloque del presupuesto. monthTotal es lo gastado en el mes en todas las categorías.
  function renderBudget(monthTotal) {
    const key = budgetMonth();
    const budget = budgetFor(key);
    swapLabel($('budgetBtnLabel'), budget ? 'Editar presupuesto' : 'Definir presupuesto');
    const show = state.period === 'mes' && state.cat === 'all' && !!budget;
    const box = $('budget');
    if (show) {
      const left = budget - monthTotal;
      const over = left < 0;
      const appearing = box.hidden || !!box.dataset.closing;
      box.classList.toggle('over', over);
      const thisMonth = daysAgo(0).slice(0, 7);
      $('budgetPre').textContent = over ? 'Te pasaste' : key < thisMonth ? 'Quedaron' : 'Te quedan'; // un mes que ya pasó va en pasado
      $('budgetMid').textContent = over ? 'de tu presupuesto de' : 'de';
      $('budgetSuffix').textContent = key === thisMonth ? 'este mes' : 'en ' + monthName(key); // siempre se dice de qué mes es
      countTo($('budgetLeft'), 'budget:left', Math.abs(left), 300);
      countTo($('budgetOf'), 'budget:of', budget, 300);
      const fill = $('budgetFill');
      const width = Math.max(0, Math.min(1, left / budget)) * 100 + '%'; // la barra muestra lo que queda, no lo gastado
      if (appearing) { // al aparecer la barra se llena desde cero; se vacía sin transición porque si no la animación se anula
        fill.style.transition = 'none'; fill.style.width = '0'; slide(box, true); void fill.offsetWidth; fill.style.transition = '';
      }
      fill.style.width = width;
    } else {
      slide(box, false);
    }
  }

  // Abre la hoja del presupuesto con el monto actual si ya hay uno
  function openBudget() {
    state.filterOpen = false;
    const key = budgetMonth();
    const current = budgetFor(key);
    $('budText').textContent = 'Cuánto querés administrar ' + (key === daysAgo(0).slice(0, 7) ? 'este mes' : 'en ' + monthName(key)) + '.';
    $('budgetAmount').value = current ? dots(String(current)) : '';
    $('budgetRemove').hidden = !current;
    // "Repetir todos los meses" arranca prendido, salvo que el mes tenga un presupuesto propio
    $('budRepeat').setAttribute('aria-checked', !monthBudget(key));
    syncRepeat();
    syncBudget();
    showDialog('budRoot');
    $('budgetAmount').focus();
    renderMain();
  }
  function closeBudget() { hideDialog('budRoot'); }
  // el interruptor "Repetir todos los meses"
  const repeating = () => $('budRepeat').getAttribute('aria-checked') === 'true';
  // texto de ayuda debajo del interruptor
  function syncRepeat() {
    const key = budgetMonth();
    $('budRepHint').textContent = repeating()
      ? 'Vale para cada mes nuevo. Podés cambiarlo cuando quieras.'
      : 'Solo para ' + MONTHS[Number(key.slice(5, 7)) - 1] + ' de ' + key.slice(0, 4) + '.';
  }
  const budgetDigits = () => $('budgetAmount').value.replace(/\D/g, '');
  // "Guardar presupuesto" se habilita solo con un monto mayor a 0
  function syncBudget() { $('budgetSave').disabled = !parseInt(budgetDigits() || '0', 10); }

  // Guarda el presupuesto: repetir prendido = para todos los meses; apagado = solo para este mes
  function saveBudget() {
    const amount = parseInt(budgetDigits() || '0', 10);
    if (!amount || amount < 0) return; // solo montos positivos
    const key = budgetMonth();
    const isNew = !budgetFor(key);
    const cur = state.currency;
    if (repeating()) { state.budgetDefault[cur] = amount; if (state.budgets[cur]) delete state.budgets[cur][key]; } // vale para todos los meses
    else (state.budgets[cur] = state.budgets[cur] || {})[key] = amount;                                             // solo para este mes
    persist();
    closeBudget();
    if (state.period !== 'mes') { // el bloque solo se ve en Mes: se cambia a esa vista para que se vea lo guardado
      const today = daysAgo(0);
      state.period = 'mes'; state.ref = key === today.slice(0, 7) ? today : key + '-01'; state.pickOpen = false; state.showAll = false;
      renderMain(true);
    } else {
      renderMain();
    }
    toast(isNew ? 'Presupuesto guardado' : 'Presupuesto actualizado');
  }

  // Quitar presupuesto: si el mes tiene uno propio se borra ese (y queda el general si hay); si no, se borra el general
  function removeBudget() {
    const key = budgetMonth();
    if (monthBudget(key)) delete state.budgets[state.currency][key];
    else delete state.budgetDefault[state.currency];
    persist();
    closeBudget();
    renderMain();
    toast('Presupuesto eliminado');
  }

  /* ---------- hoja del informe ---------- */
  // Hoja "Descargar informe": elegir Todo o Por categorías y ver cuántos gastos entran (openReport, syncReport).
  // El informe siempre es del período y la moneda que se están viendo.
  // periodLabel: "4 de Octubre de 2026", "Septiembre de 2026" o "2026"
  function periodLabel() {
    const r = state.ref;
    const y = r.slice(0, 4);
    const m = MONTHS[Number(r.slice(5, 7)) - 1];
    if (state.period === 'dia') return Number(r.slice(8, 10)) + ' de ' + m + ' de ' + y;
    if (state.period === 'mes') return m + ' de ' + y;
    return y;
  }
  const countLabel = (n) => n + (n === 1 ? ' gasto' : ' gastos');

  // Gastos que entran en el informe (moneda activa, período y categorías elegidas), del más nuevo al más viejo
  function reportItems() {
    const rep = state.report;
    return activeExpenses()
      .filter((e) => inPeriod(e) && (rep.scope === 'all' || rep.cats[e.cat]))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  // Actualiza la hoja: pastilla, categorías marcadas, resumen en vivo y botón habilitado o no
  function syncReport() {
    const rep = state.report;
    document.querySelectorAll('#repScope [data-scope]').forEach((b) => {
      const on = b.dataset.scope === rep.scope;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    placeThumb($('repScope'));
    $('repCats').querySelectorAll('[data-cat]').forEach((b) => {
      const on = !!rep.cats[b.dataset.cat];
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    slide($('repCatsField'), rep.scope === 'cats');
    const items = reportItems();
    $('repSummary').innerHTML = '<strong>' + countLabel(items.length) + '</strong> · ' + money(items.reduce((t, e) => t + e.amount, 0));
    $('repDownload').disabled = !items.length;
  }

  // Abre la hoja del informe
  function openReport() {
    state.filterOpen = false;
    // si en pantalla hay una categoría filtrada, el informe arranca con esa elegida
    state.report = state.cat === 'all' ? { scope: 'all', cats: {} } : { scope: 'cats', cats: { [state.cat]: true } };
    $('repText').textContent = 'Un PDF con tus gastos de ' + periodLabel() + '.';
    $('repCats').innerHTML = CATS.map((c) =>
      '<button data-action="toggle-report-cat" data-cat="' + c.id + '" aria-pressed="false">' + icon(c.d, 18) + esc(c.name) + '</button>').join('');
    $('repCatsField').hidden = state.report.scope !== 'cats'; // al abrir va sin animación
    showDialog('repRoot');
    placeThumb($('repScope'), true);
    syncReport();
    $('repScope').querySelector('button').focus();
    renderMain();
  }
  function closeReport() { hideDialog('repRoot'); }

  /* ---------- informe pdf ---------- */
  // Arma el PDF con jsPDF y autoTable (se cargan desde cdnjs en index.html) y lo descarga: downloadReport.

  // Ícono de la app dibujado a mano (jsPDF no lee SVG): cuadrado de 16 mm con la "b.", mismas medidas que el logo
  function drawIcon(doc, x, y) {
    doc.setFillColor('#FFFFFF');
    doc.setDrawColor('#CFE0DC');
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, 16, 16, 4.4, 4.4, 'FD');
    const s = 9 / 28; // la "b." mide 9 mm y el SVG 28 unidades
    const ox = x + (16 - 28 * s) / 2, oy = y + (16 - 28 * s) / 2;
    const px = (u) => ox + (u - 3.4) * s, py = (u) => oy + u * s;
    doc.setDrawColor('#356B67');
    doc.setFillColor('#356B67');
    doc.setLineCap('round');
    doc.setLineWidth(3.4 * s);
    doc.line(px(8), py(4.5), px(8), py(23.5));
    doc.circle(px(14.5), py(17), 6.5 * s, 'S');
    doc.circle(px(27), py(23.3), 2 * s, 'F');
    doc.setLineCap('butt');
  }

  // Arma y descarga el informe: encabezado, total, presupuesto, por categoría y detalle de gastos
  function downloadReport() {
    const items = reportItems();
    if (!items.length) return;
    if (!window.jspdf) { toast('No se pudo generar el PDF'); return; } // sin internet no carga jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const C = { primary: '#356B67', text: '#1D292D', text2: '#5F6C70', border: '#E5EAE8', tint: '#E9F0EE', danger: '#A24B3B' };
    // medidas de una hoja A4 en mm, con márgenes de 15 y el pie a 25 del borde
    const W = 210, H = 297, L = 15, R = W - 15, BOTTOM = H - 25;
    const rep = state.report;
    const title = 'Gastos de ' + periodLabel();
    const total = items.reduce((t, e) => t + e.amount, 0);
    const text = (str, x, y, size, color, style, opts) => {
      doc.setFont('helvetica', style || 'normal');
      doc.setFontSize(size);
      doc.setTextColor(color);
      doc.text(str, x, y, opts || {});
    };
    // ancho sin kerning: los visores dibujan sin kerning y si se mide con él los textos seguidos se pisan
    const widthOf = (str) => doc.getStringUnitWidth(str, { kerning: {} }) * doc.getFontSize() / doc.internal.scaleFactor;
    // el € se encimaba con los números (Helvetica no trae su ancho): en ese caso va el código, "EUR 3.800"
    const sym = CURRENCIES[state.currency].symbol;
    const pdfMoney = (v) => (latin(sym) === sym ? money(v) : state.currency + ' ' + dots(String(Math.round(v))));
    // por si llega un emoji desde un respaldo viejo: Helvetica no lo dibuja
    const pdfText = (str) => latin(str).replace(/\s+/g, ' ').trim() || 'Gasto';
    const rule = (y, width, color) => { doc.setDrawColor(color); doc.setLineWidth(width); doc.line(L, y, R, y); };

    // encabezado de la página 2 en adelante
    const pageHeader = (section) => {
      drawIcon(doc, L, 15);
      text(title, L + 20, 23, 12, C.text, 'bold', { baseline: 'middle' });
      text(section, L, 38, 12, C.text, 'bold');
    };
    let y;
    // si lo que sigue no entra en la página, pasa a una nueva con encabezado
    const ensureSpace = (h, section) => {
      if (y + h <= BOTTOM) return;
      doc.addPage();
      pageHeader(section);
      y = 44;
    };

    // página 1: ícono, título y subtítulo (con la moneda)
    drawIcon(doc, L, 15);
    text('Informe de gastos', R, 23, 9.5, C.text2, 'normal', { align: 'right', baseline: 'middle' });
    text(title, L, 35, 21, C.text, 'bold', { baseline: 'top' });
    const chosen = CATS.filter((c) => items.some((e) => e.cat === c.id)); // solo las categorías con gastos en el informe (items ya respeta el filtro)
    const scopeText = rep.scope === 'all' ? 'Todas las categorías'
      : chosen.length > 3 ? chosen.length + ' categorías' : chosen.map((c) => pdfText(c.name)).join(', ');
    const curText = 'Moneda: ' + pdfText(CURRENCIES[state.currency].label) + ' (' + state.currency + ')';
    text(scopeText + ' · ' + countLabel(items.length) + ' · ' + curText, L, 45, 10.5, C.text2, 'normal', { baseline: 'top' });

    // total y, solo en la vista Mes con todas las categorías, cuánto quedó del presupuesto
    text('Total gastado', L, 56, 10, C.text2, 'normal', { baseline: 'top' });
    text(pdfMoney(total), L, 61, 34, C.text, 'bold', { baseline: 'top' });
    const budget = state.period === 'mes' && rep.scope === 'all' ? budgetFor(budgetMonth()) : 0;
    if (budget) {
      const left = budget - total;
      const over = left < 0;
      const BW = 69, BX = R - BW;
      const parts = [[over ? 'Te pasaste por ' : 'Quedaron ', 'normal', C.text2], [pdfMoney(Math.abs(left)), 'bold', over ? C.danger : C.text], [' de ' + pdfMoney(budget), 'normal', C.text2]];
      let size = 10.5, width; // con montos muy largos la letra se achica para que entre
      do {
        doc.setFontSize(size);
        width = parts.reduce((t, p) => { doc.setFont('helvetica', p[1]); return t + widthOf(p[0]); }, 0);
      } while (width > BW && (size -= 0.5) > 7);
      let x = R - width;
      parts.forEach((p) => {
        text(p[0], x, 66, size, p[2], p[1], { baseline: 'top' });
        doc.setFont('helvetica', p[1]);
        x += widthOf(p[0]);
      });
      doc.setFillColor(C.tint);
      doc.roundedRect(BX, 72, BW, 1.6, 0.8, 0.8, 'F');
      const ratio = Math.max(0, Math.min(1, left / budget)); // la barra muestra lo que queda, como en la app
      if (ratio > 0) { doc.setFillColor(C.primary); doc.roundedRect(BX, 72, Math.max(1.6, BW * ratio), 1.6, 0.8, 0.8, 'F'); }
    }

    // por categoría (sin íconos: jsPDF no dibuja paths de SVG)
    y = 86;
    text('Por categoría', L, y, 12, C.text, 'bold', { baseline: 'top' });
    y += 7;
    rule(y, 0.3, C.text);
    chosen.forEach((c) => {
      ensureSpace(10.5, 'Por categoría');
      const mine = items.filter((e) => e.cat === c.id);
      const mid = y + 5.25;
      const name = pdfText(c.name);
      text(name, L, mid, 10.5, C.text, 'normal', { baseline: 'middle' });
      doc.setFontSize(10.5);
      text(countLabel(mine.length), L + widthOf(name) + 3, mid, 9, C.text2, 'normal', { baseline: 'middle' });
      text(pdfMoney(mine.reduce((t, e) => t + e.amount, 0)), R, mid, 10.5, C.text, 'bold', { align: 'right', baseline: 'middle' });
      y += 10.5;
      rule(y, 0.2, C.border);
    });

    // detalle de gastos (tabla de autoTable)
    y += 10;
    ensureSpace(30, 'Detalle de gastos'); // que el título no quede solo al pie de la página
    text('Detalle de gastos', L, y, 12, C.text, 'bold', { baseline: 'top' });
    const firstTablePage = doc.internal.getCurrentPageInfo().pageNumber;
    const shortDate = (iso) => Number(iso.slice(8, 10)) + ' ' + MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]; // nunca "Hoy"
    doc.autoTable({
      startY: y + 7,
      margin: { top: 44, bottom: 25, left: L, right: 15 },
      theme: 'plain',
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'avoid', // sin esto una fila se partía y quedaba una franja vacía en la página siguiente
      head: [['Fecha', 'Descripción', 'Categoría', 'Monto']],
      body: items.map((e) => [shortDate(e.date), pdfText(e.desc), CAT[e.cat] ? pdfText(CAT[e.cat].name) : '', pdfMoney(e.amount)]),
      foot: [['', '', 'Total', pdfMoney(total)]],
      styles: { font: 'helvetica', fontSize: 10.5, textColor: C.text, valign: 'middle', minCellHeight: 9.2, cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 } },
      headStyles: { fontSize: 9, fontStyle: 'bold', textColor: C.text2, minCellHeight: 8 },
      footStyles: { fontStyle: 'bold', textColor: C.text, minCellHeight: 11 },
      columnStyles: {
        0: { cellWidth: 19, fontSize: 9.5, textColor: C.text2 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40, fontSize: 9.5, textColor: C.text2 },
        3: { cellWidth: 29, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (d) => {
        if (d.column.index === 0) d.cell.styles.cellPadding = { top: 1.5, bottom: 1.5, left: 0, right: 1.5 }; // alineado al margen
        if (d.column.index === 3) { d.cell.styles.halign = 'right'; d.cell.styles.cellPadding = { top: 1.5, bottom: 1.5, left: 1.5, right: 0 }; }
        if (d.section === 'head') { d.cell.styles.fontSize = 9; d.cell.styles.textColor = C.text2; }
        if (d.section === 'foot') {
          d.cell.styles.textColor = C.text;
          d.cell.styles.fontSize = d.column.index === 3 ? 12 : 10.5;
          if (d.column.index === 2) d.cell.styles.halign = 'right';
        }
      },
      didDrawCell: (d) => { // el tema plain no tiene líneas, se dibujan a mano
        if (d.section === 'foot') return;
        const yb = d.cell.y + d.cell.height;
        doc.setDrawColor(d.section === 'head' ? C.text : C.border);
        doc.setLineWidth(d.section === 'head' ? 0.3 : 0.2);
        doc.line(d.cell.x, yb, d.cell.x + d.cell.width, yb);
      },
      didDrawPage: () => {
        if (doc.internal.getCurrentPageInfo().pageNumber > firstTablePage) pageHeader('Detalle de gastos');
      }
    });

    // pie en todas las páginas (al final, cuando ya se sabe cuántas hay)
    const t = daysAgo(0);
    const today = Number(t.slice(8, 10)) + ' de ' + MONTHS[Number(t.slice(5, 7)) - 1] + ' de ' + t.slice(0, 4);
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      text('Informe generado el ' + today, L, H - 11, 9, C.text2);
      text('Página ' + i + ' de ' + pages, R, H - 11, 9, C.text2, 'normal', { align: 'right' });
    }

    // nombre del archivo con el período y la moneda: berde-informe-2026-10-USD.pdf
    const r = state.ref;
    const base = state.period === 'mes' ? r.slice(0, 7) : state.period === 'dia' ? r : r.slice(0, 4);
    doc.save('berde-informe-' + base + '-' + state.currency + (rep.scope === 'cats' ? '-filtrado' : '') + '.pdf');
    closeReport();
    toast('Informe descargado');
  }

  /* ---------- menu de cuenta ---------- */
  // El menu de cuenta se abre tocando el saludo. Sus opciones están en las secciones que siguen:
  // moneda, respaldo (exportar e importar), reportar un problema (link armado en arranque) y cerrar sesion y borrar datos.
  // closeAccount lo cierra; con focus, el foco vuelve al saludo.
  function closeAccount(focus) {
    if (!state.accOpen) return;
    state.accOpen = false;
    renderMain();
    if (focus) $('accBtn').focus();
  }

  /* ---------- moneda ---------- */
  // La moneda activa funciona como una cuenta aparte: cada una tiene sus gastos y su presupuesto.
  // syncCurrency actualiza el símbolo en pantalla y la hoja de moneda; pickCurrency cambia de moneda.
  function syncCurrency() {
    const c = CURRENCIES[state.currency];
    document.querySelectorAll('.cur').forEach((el) => { el.textContent = c.symbol; });
    $('accCur').textContent = state.currency + ' · ' + c.symbol;
    $('curOptions').innerHTML = Object.keys(CURRENCIES).map((code) => {
      const on = code === state.currency;
      return '<button data-action="pick-currency" data-cur="' + code + '" aria-pressed="' + on + '"' + (on ? ' class="on"' : '') + '>' +
        '<span class="cur-sym">' + esc(CURRENCIES[code].symbol) + '</span><span class="cur-name">' + esc(CURRENCIES[code].label) + '</span>' +
        '<span class="cur-code">' + code + '</span></button>';
    }).join('');
  }
  // Abre la hoja de moneda con el foco en la moneda actual
  function openCurrency() {
    closeAccount();
    syncCurrency();
    showDialog('curRoot');
    $('curOptions').querySelector('.on').focus();
  }
  function closeCurrency() { hideDialog('curRoot'); }
  // Cambia de moneda: desde ahí se ve, se carga y se descarga solo lo de la moneda nueva
  function pickCurrency(code) {
    if (!isCurrency(code)) return;
    if (code === state.currency) { closeCurrency(); return; }
    state.currency = code;
    persist();
    // se resetean los contadores para que no corran desde el monto de la otra moneda (pasar de $90.000 a US$40 confunde)
    Object.keys(counters).forEach((k) => { cancelAnimationFrame(counters[k].raf); delete counters[k]; });
    state.accOpen = false; state.filterOpen = false;
    state.cat = 'all'; state.showAll = false;
    closeCurrency();
    syncCurrency();
    renderMain();
    toast('Ahora usás ' + CURRENCIES[code].label + ' (' + CURRENCIES[code].symbol + ')');
  }

  /* ---------- respaldo (exportar e importar) ---------- */
  // Exportar descarga un .json con todos los datos (todas las monedas). Importar lo reemplaza todo y recarga.
  // exportData, cleanBackup (valida el archivo) e importFile.
  function exportData() {
    closeAccount(true);
    const backup = { app: 'berde', version: APP_VERSION, exportedAt: new Date().toISOString(), data: snapshot() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'berde-respaldo-' + daysAgo(0) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Respaldo descargado');
  }

  // Revisa los datos antes de usarlos (respaldo importado o lo guardado en el navegador): solo pasa lo que tiene
  // la forma esperada, el resto se tira. Los ids y los íconos se meten en el HTML, por eso solo letras, números
  // y poco más (para que no inyecten código). Acepta el formato viejo (campos que faltan, sin moneda).
  const ID_RE = /^[a-z0-9]+$/i;
  const ICON_RE = /^[A-Za-z0-9 .,\-]+$/;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const isAmount = (n) => Number.isSafeInteger(n) && n > 0;
  // Respaldo: el sobre tiene que ser { app: 'berde', data }. Devuelve los datos limpios o null.
  function cleanBackup(file) {
    if (!isObj(file) || file.app !== 'berde') return null;
    return cleanData(file.data, true);
  }
  // fromFile: con un respaldo también se sacan emojis y se cortan las descripciones largas. Con lo guardado en el
  // navegador no, porque es texto que el usuario ya ve (y antes no había límite) y no se quiere cambiar ni perder.
  function cleanData(d, fromFile) {
    if (!isObj(d) || !Array.isArray(d.expenses)) return null;
    const out = { expenses: [], learned: {}, customCats: [], renames: {}, icons: {}, deleted: [], budgets: {}, budgetDefault: {}, currency: 'ARS', order: [] };
    const fileCur = isCurrency(d.currency) ? d.currency : 'ARS'; // respaldos viejos: los gastos sin moneda van a esta

    const seen = new Set();
    (Array.isArray(d.customCats) ? d.customCats : []).forEach((c) => {
      if (!isObj(c) || typeof c.id !== 'string' || !ID_RE.test(c.id) || DEFAULT_IDS.includes(c.id) || seen.has(c.id)) return;
      const name = typeof c.name === 'string' ? (fromFile ? latin(c.name) : c.name).trim() : ''; // categoria personalizada
      if (!name || typeof c.d !== 'string' || !ICON_RE.test(c.d)) return;
      seen.add(c.id);
      out.customCats.push({ id: c.id, name: name.slice(0, 24), d: c.d, custom: true });
    });
    if (Array.isArray(d.deleted)) out.deleted = DEFAULT_IDS.filter((id) => id !== 'otros' && d.deleted.includes(id)); // "Otros" nunca se elimina
    const valid = new Set(DEFAULT_IDS.filter((id) => !out.deleted.includes(id)).concat(out.customCats.map((c) => c.id)));

    if (isObj(d.renames)) DEFAULT_IDS.forEach((id) => { const n = typeof d.renames[id] === 'string' ? (fromFile ? latin(d.renames[id]) : d.renames[id]).trim() : ''; if (n) out.renames[id] = n.slice(0, 24); });
    if (isObj(d.icons)) DEFAULT_IDS.forEach((id) => { const v = d.icons[id]; if (typeof v === 'string' && ICON_RE.test(v)) out.icons[id] = v; });
    if (Array.isArray(d.order)) out.order = d.order.filter((id) => typeof id === 'string' && valid.has(id));
    if (isObj(d.learned)) Object.keys(d.learned).forEach((k) => { if (k !== '__proto__' && k.length <= 80 && valid.has(d.learned[k])) out.learned[k] = d.learned[k]; });

    const ids = new Set();
    d.expenses.forEach((e) => {
      if (!isObj(e) || typeof e.desc !== 'string' || !isAmount(e.amount) || !isValidDate(e.date) || typeof e.cat !== 'string') return; // gasto inválido: se tira
      let id = typeof e.id === 'string' && ID_RE.test(e.id) && !ids.has(e.id) ? e.id : uid();
      while (ids.has(id)) id = uid();
      ids.add(id);
      const desc = fromFile ? (latin(e.desc).replace(/\s+/g, ' ').trim() || 'Gasto').slice(0, 80) : (e.desc || 'Gasto');
      out.expenses.push({ id: id, desc: desc, amount: e.amount, cat: valid.has(e.cat) ? e.cat : 'otros', date: e.date, cur: isCurrency(e.cur) ? e.cur : fileCur });
    });

    const b = budgetsByCurrency(d.budgets, d.budgetDefault, fileCur); // presupuestos viejos (sin moneda) van a la del archivo
    out.budgets = b.budgets;
    out.budgetDefault = b.defaults;
    out.currency = fileCur;
    return out;
  }

  // Abre el diálogo de importar (el foco va a Cancelar porque importar reemplaza todo)
  function openImport() {
    closeAccount();
    $('impError').hidden = true;
    showDialog('impRoot');
    $('impCancel').focus();
  }
  function closeImport() { hideDialog('impRoot'); }
  function importError(text) { $('impError').textContent = text; $('impError').hidden = false; }

  // Lee el archivo elegido y, si está bien, lo guarda y recarga la app (el aviso se muestra después de recargar)
  async function importFile(file) {
    if (!file) return;
    // 5 MB alcanza para miles de gastos; más grande no es un respaldo
    if (file.size > 5 * 1024 * 1024) { importError('El archivo es demasiado grande.'); return; }
    let data = null;
    try { data = cleanBackup(JSON.parse(await file.text())); } catch (e) { data = null; }
    if (!data) { importError('El archivo no es un respaldo de berde.'); return; } // no se toca nada de lo actual
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      sessionStorage.setItem(TOAST_KEY, 'Datos importados');
    } catch (e) { importError('No se pudieron guardar los datos.'); return; }
    location.reload();
  }

  /* ---------- cerrar sesion y borrar datos ---------- */
  // Las dos últimas opciones del menu de cuenta.
  // Cerrar sesión: vuelve a la pantalla de ingreso, los datos quedan guardados.
  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignorar */ }
    location.reload();
  }

  // Borrar mis datos: primero pide confirmar (el foco va a Cancelar por ser destructivo)
  function openWipe() {
    closeAccount();
    showDialog('wipeRoot');
    $('wipeCancel').focus();
  }
  function closeWipe() { hideDialog('wipeRoot'); }
  // borra todos los gastos y presupuestos de todas las monedas
  function wipe() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignorar */ }
    location.reload();
  }

  /* ---------- hoja del gasto ---------- */
  // Hoja para agregar o editar un gasto: monto, descripción, categoría sugerida y fecha del gasto.
  // openSheet, syncSheet, save y remove.
  // Botón de fecha del gasto: "Hoy · 4 de Octubre", "30 sep" o, de otro año, "12 de Septiembre de 2025"
  function dateBtnLabel(iso) {
    const today = daysAgo(0);
    const d = Number(iso.slice(8, 10)), m = Number(iso.slice(5, 7)) - 1;
    if (iso === today) return 'Hoy · ' + d + ' de ' + MONTHS[m];
    if (iso.slice(0, 4) === today.slice(0, 4)) return d + ' ' + MONTHS_SHORT[m];
    return d + ' de ' + MONTHS[m] + ' de ' + iso.slice(0, 4);
  }
  // para el aviso "Gasto guardado el 12 de Septiembre"
  function longDate(iso) {
    const label = Number(iso.slice(8, 10)) + ' de ' + MONTHS[Number(iso.slice(5, 7)) - 1];
    return iso.slice(0, 4) === daysAgo(0).slice(0, 4) ? label : label + ' de ' + iso.slice(0, 4);
  }
  // Fecha del gasto al crearlo: hoy si cae en lo que se está viendo; si no, el último día de ese período,
  // así el gasto aparece en la pantalla en vez de "desaparecer" en otro mes
  function defaultExpenseDate() {
    const today = daysAgo(0);
    if (inPeriod({ date: today })) return today;
    const r = state.ref;
    if (state.period === 'dia') return r;
    if (state.period === 'mes') return toISO(new Date(Number(r.slice(0, 4)), Number(r.slice(5, 7)), 0)); // el día 0 del mes siguiente es el último de este
    return r.slice(0, 4) + '-12-31';
  }
  // pone la fecha del gasto en el botón y en el input (max = hoy: no hay gastos a futuro)
  function syncDate() {
    $('expDate').max = daysAgo(0);
    $('expDate').value = state.draft.date;
    $('dateLabel').textContent = dateBtnLabel(state.draft.date);
  }

  // categoría elegida a mano o, si no, la sugerida por la descripción
  function currentCat() { return state.draft.manualCat || detect(state.draft.desc); }

  // Actualiza la hoja del gasto: chip de categoría, selector y botón Guardar
  function syncSheet() {
    const d = state.draft;
    const id = currentCat();
    $('chipIcon').setAttribute('d', CAT[id].d);
    $('chipName').textContent = CAT[id].name;
    $('chip').classList.toggle('faded', !d.desc.trim() && !d.manualCat);
    $('chip').setAttribute('aria-expanded', d.pickerOpen);
    $('picker').hidden = !d.pickerOpen;
    $('picker').innerHTML = CATS.map((c) =>
      '<button data-action="pick-cat" data-cat="' + c.id + '"' + (c.id === id ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' +
      icon(c.d, 18) + esc(c.name) + '</button>').join('');
    $('saveBtn').disabled = !parseInt(d.digits || '0', 10);
  }

  // Abre la hoja: mode 'new' para un gasto nuevo o 'edit' con el gasto a editar
  function openSheet(mode, expense) {
    state.sheet = mode;
    state.filterOpen = false;
    state.draft = expense
      ? { id: expense.id, digits: String(expense.amount), desc: expense.desc, manualCat: expense.cat, date: expense.date, pickerOpen: false }
      : { id: null, digits: '', desc: '', manualCat: null, date: defaultExpenseDate(), pickerOpen: false };
    $('sheetTitle').textContent = mode === 'edit' ? 'Editar gasto' : 'Nuevo gasto';
    $('amount').value = dots(state.draft.digits);
    $('desc').value = state.draft.desc;
    syncDate();
    $('deleteBtn').hidden = mode !== 'edit';
    showDialog('sheetRoot');
    renderMain();
    syncSheet();
    (mode === 'new' ? $('amount') : $('desc')).focus();
  }

  function closeSheet() {
    state.sheet = null;
    hideDialog('sheetRoot');
    renderMain();
  }

  // Guarda el gasto (nuevo o editado). Al editar, la moneda del gasto no cambia.
  function save() {
    const d = state.draft;
    const amount = parseInt(d.digits || '0', 10);
    if (!amount) return;
    const auto = detect(d.desc);
    const cat = d.manualCat || auto;
    const text = d.desc.trim();
    const desc = text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Gasto';

    // si el usuario corrigió la categoría sugerida, se recuerda para la próxima vez
    if (d.manualCat && d.manualCat !== auto && norm(d.desc)) state.learned[norm(d.desc)] = d.manualCat;

    if (state.sheet === 'edit') {
      state.expenses = state.expenses.map((e) => (e.id === d.id ? Object.assign({}, e, { desc: desc, amount: amount, cat: cat, date: d.date }) : e));
    } else {
      state.expenses.unshift({ id: uid(), desc: desc, amount: amount, cat: cat, date: d.date, cur: state.currency }); // queda en la moneda activa
    }
    persist();
    // si el gasto quedó fuera de lo que se ve, el aviso dice la fecha para que no parezca perdido
    const msg = state.sheet === 'edit' ? 'Cambios guardados' : inPeriod({ date: d.date }) ? 'Gasto guardado' : 'Gasto guardado el ' + longDate(d.date);
    closeSheet();
    toast(msg);
  }

  // Botón "Eliminar gasto" de la hoja (solo al editar)
  function remove() {
    state.expenses = state.expenses.filter((e) => e.id !== state.draft.id);
    persist();
    closeSheet();
    toast('Gasto eliminado');
  }

  /* ---------- avisos ---------- */
  // Cartelito de abajo con un tilde ("Gasto guardado", etc.). Se va solo a los 1,8 s.
  // El texto va con textContent (no como HTML), así un nombre con < o & se ve tal cual. No hace falta esc().
  let toastTimer;
  function toast(text) {
    const el = $('toast');
    el.innerHTML = checkIcon.replace('width="18" height="18"', 'width="20" height="20"') + '<span></span>'; // solo el ícono fijo
    el.querySelector('span').textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  /* ---------- hoja de categoria ---------- */
  // Hoja para crear una categoria personalizada o editar el nombre y el ícono de cualquier categoría.
  // openCat, syncCat y saveCat. Abajo, los íconos que se pueden elegir (mismo estilo de trazo que los de la app).
  const CUSTOM_ICONS = [
    // primero los de las categorías que trae la app
    ...['comida', 'compras', 'transporte', 'hogar', 'suscripciones', 'entretenimiento', 'otros'].map((id) => [CAT[id].name, CAT[id].d]),
    ['Mascotas', 'M9 4a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 8a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z'],
    ['Corazón', 'M12 21 3.6 12.6a5.1 5.1 0 0 1 7.2-7.2L12 6.6l1.2-1.2a5.1 5.1 0 0 1 7.2 7.2z'],
    ['Salud', 'M11 2v2M5 2v2M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1M8 15a6 6 0 0 0 12 0v-3M18 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
    ['Medicamentos', 'M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7ZM8.5 8.5l7 7'],
    ['Belleza', 'M12 16.2A4.2 4.2 0 1 1 7.8 12 4.2 4.2 0 1 1 12 7.8a4.2 4.2 0 1 1 4.2 4.2 4.2 4.2 0 1 1-4.2 4.2M9.8 12a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0'],
    ['Peluquería', 'M3 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.12 8.12 12 12M20 4 8.12 15.88M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14.8 14.8 20 20'],
    ['Educación', 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5'],
    ['Libros', 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
    ['Viajes', 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'],
    ['Equipaje', 'M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14M10 20h4M14 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0M6 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
    ['Auto', 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 17h6M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
    ['Combustible', 'M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5'],
    ['Gimnasio', 'M6 6h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM5 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2M17 6h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM19 9h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2M8 12h8'],
    ['Ropa', 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z'],
    ['Café', 'M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2'],
    ['Regalos', 'M4 8h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5'],
    ['Bebé', 'M10.5 5.5c0-1.7.7-3 1.5-3s1.5 1.3 1.5 3M9 5.5h6v2.5H9zM9.5 8 8 10.5V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10.5L14.5 8M8 13h3M8 16.5h3'],
    ['Familia', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'],
    ['Trabajo', 'M12 12h.01M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M22 13a18.15 18.15 0 0 1-20 0M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'],
    ['Computadora', 'M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16'],
    ['Celular', 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01'],
    ['Internet', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20'],
    ['Facturas', 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1ZM14 8H8M16 12H8M13 16H8'],
    ['Tarjeta', 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20'],
    ['Banco', 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z'],
    ['Dinero', 'M8.5 3h7l-2 4h-3zM10.5 7C6.5 9 4 13 4 16.5A4.5 4.5 0 0 0 8.5 21h7a4.5 4.5 0 0 0 4.5-4.5C20 13 17.5 9 13.5 7M14 12h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3H10M12 11v1M12 18v1'],
    ['Arreglos', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
    ['Tragos', 'M4 3h16l-8 9zM12 12v9M8 21h8M6.7 6h10.6M13 7.2a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M15 6.2l2.5-4'],
    ['Favoritos', 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z']
  ];

  let editingCat = null; // id de la categoría que se edita (null = categoria personalizada nueva)
  let catIcon = null;    // ícono elegido (posición en CUSTOM_ICONS)
  let catSaving = false; // evita crearla dos veces con doble clic

  function renderCatIcons() {
    $('catIcons').innerHTML = CUSTOM_ICONS.map((ic, i) =>
      '<button type="button" data-action="pick-icon" data-icon="' + i + '" role="radio" aria-checked="' + (i === catIcon) + '" aria-label="' + ic[0] + '"' +
      (i === catIcon ? ' class="on"' : '') + '>' + icon(ic[1], 20) + '</button>').join('');
  }
  // Habilita "Crear categoría" solo con nombre, ícono y sin repetir un nombre que ya existe
  function syncCat() {
    const n = norm($('catName').value);
    const dup = !!n && CATS.some((c) => c.id !== editingCat && norm(c.name) === n);
    $('catError').hidden = !dup;
    $('catSave').disabled = !n || dup || (!editingCat && catIcon === null) || catSaving;
  }
  // Abre la hoja: sin id para una nueva, con id para editar
  function openCat(id) {
    state.filterOpen = false;
    editingCat = id || null;
    catIcon = null;
    catSaving = false;
    $('catTitle').textContent = editingCat ? 'Editar categoría' : 'Nueva categoría';
    $('catName').value = editingCat ? CAT[editingCat].name : '';
    if (editingCat) { // se marca el ícono actual; si no está en la grilla no se marca nada y se conserva
      const i = CUSTOM_ICONS.findIndex((ic) => ic[1] === CAT[editingCat].d);
      catIcon = i < 0 ? null : i;
    }
    $('catSave').textContent = editingCat ? 'Guardar' : 'Crear categoría';
    renderCatIcons();
    syncCat();
    showDialog('catRoot');
    $('catName').focus();
    $('catName').select();
    renderMain();
  }
  function closeCat() { hideDialog('catRoot'); }
  // Guarda la categoría nueva o los cambios
  function saveCat() {
    syncCat();
    if ($('catSave').disabled) return;
    catSaving = true;
    $('catSave').disabled = true;
    const raw = $('catName').value.trim();
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (editingCat) {
      const c = CAT[editingCat];
      c.name = name;
      if (catIcon !== null) c.d = CUSTOM_ICONS[catIcon][1];
      if (!c.custom) { // las de la app se guardan como cambios (renames, icons); las personalizadas, enteras en customCats
        state.renames[editingCat] = name;
        if (catIcon !== null) state.icons[editingCat] = c.d;
      }
    } else {
      const c = { id: 'c' + uid(), name: name, d: CUSTOM_ICONS[catIcon][1], custom: true };
      addCatOnTop(c);
      state.customCats.push(c);
    }
    persist();
    const msg = editingCat ? 'Categoría actualizada' : 'Categoría creada';
    closeCat();
    renderMain();
    toast(msg);
  }

  /* ---------- eliminar categoria ---------- */
  // Tacho de la categoría seleccionada: pide confirmar y pasa sus gastos (de todas las monedas) a "Otros".
  let deletingCat = null; // categoría a eliminar (null = ya se eliminó o se canceló)

  function openDeleteCat(id) {
    if (!CAT[id] || id === 'otros') return; // "Otros" recibe los gastos, por eso no se puede eliminar
    deletingCat = id;
    state.filterOpen = false;
    const n = state.expenses.filter((e) => e.cat === id).length; // todas las monedas: a todas les pasa
    $('delText').textContent = n
      ? (n === 1 ? 'Su gasto pasa' : 'Sus ' + n + ' gastos pasan') + ' a ' + CAT.otros.name + '. No se borra ningún gasto.'
      : 'No tiene gastos registrados.';
    $('delTitle').textContent = '¿Eliminar ' + CAT[id].name + '?';
    showDialog('delRoot');
    $('delCancel').focus();
    renderMain();
  }
  function closeDeleteCat() { deletingCat = null; hideDialog('delRoot'); }

  function deleteCat() {
    const id = deletingCat;
    if (!id || !CAT[id]) return; // evita eliminar dos veces con doble clic
    deletingCat = null;
    const name = CAT[id].name;
    state.expenses.forEach((e) => { if (e.cat === id) e.cat = 'otros'; }); // los gastos no se pierden
    Object.keys(state.learned).forEach((k) => { if (state.learned[k] === id) delete state.learned[k]; });
    if (CAT[id].custom) state.customCats = state.customCats.filter((c) => c.id !== id);
    else { delete state.renames[id]; state.deleted.push(id); }
    dropCat(id);
    if (state.cat === id) state.cat = 'all';
    state.showAll = false;
    persist();
    hideDialog('delRoot');
    renderMain();
    toast('Se eliminó ' + name);
  }

  /* ---------- reordenar categorias ---------- */
  // Mantener apretada una categoría y arrastrarla para cambiar el orden. Con teclado: Alt + flecha arriba o abajo.
  // startDrag, updateDrag y endDrag.
  const HOLD_MS = 350; // lo que hay que mantener apretado; menos se confundía con un toque
  let press = null;   // pulsación en curso, todavía sin activar
  let drag = null;    // arrastre activo
  let justDragged = false;
  const rowsOf = () => Array.from($('cats').querySelectorAll('.cat-item'));

  $('cats').addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.cat-select');
    if (!btn || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cancelPress();
    press = { x: e.clientX, y: e.clientY, btn: btn, row: btn.parentElement, pointerId: e.pointerId, timer: setTimeout(startDrag, HOLD_MS) };
  });
  function cancelPress() { if (press) { clearTimeout(press.timer); press = null; } }

  // empieza el arrastre: la fila se levanta y las demás se preparan para correrse
  function startDrag() {
    if (!press) return;
    const rows = rowsOf();
    const row = press.row;
    const index = rows.indexOf(row);
    const step = rows.length > 1 ? rows[1].offsetTop - rows[0].offsetTop : row.offsetHeight;
    drag = { rows: rows, row: row, index: index, target: index, step: step, startY: press.y, clientY: press.y, startScroll: window.scrollY, raf: 0 };
    try { press.btn.setPointerCapture(press.pointerId); } catch (err) { /* ignorar */ }
    cancelPress();
    document.body.classList.add('reordering');
    row.classList.add('lifted');
    rows.forEach((r) => { if (r !== row) r.classList.add('shifting'); });
    if (navigator.vibrate) navigator.vibrate(12);
    autoScroll();
  }

  // mueve la fila con el dedo y corre las de al lado
  function updateDrag() {
    const d = drag;
    const raw = d.clientY - d.startY + (window.scrollY - d.startScroll);
    const dy = Math.max(-d.index * d.step, Math.min((d.rows.length - 1 - d.index) * d.step, raw));
    d.row.style.transform = 'translateY(' + dy + 'px)';
    d.target = Math.max(0, Math.min(d.rows.length - 1, Math.round(d.index + dy / d.step)));
    d.rows.forEach((r, i) => {
      if (r === d.row) return;
      let shift = 0;
      if (d.index < d.target && i > d.index && i <= d.target) shift = -d.step;
      else if (d.index > d.target && i >= d.target && i < d.index) shift = d.step;
      r.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
    });
  }

  // Si el dedo o el cursor llega al borde de la pantalla, la lista se desplaza sola
  function autoScroll() {
    if (!drag) return;
    const edge = 70;
    const y = drag.clientY;
    let v = 0;
    if (y < edge) v = -Math.ceil((edge - y) / 6);
    else if (y > window.innerHeight - edge) v = Math.ceil((y - (window.innerHeight - edge)) / 6);
    if (v) { window.scrollBy(0, v); updateDrag(); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  // suelta: la fila se acomoda y se guarda el orden nuevo
  function endDrag() {
    const d = drag;
    if (!d) return;
    drag = null;
    cancelAnimationFrame(d.raf);
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 80);
    d.row.classList.remove('lifted');
    d.row.classList.add('settling'); // la fila se acomoda suavemente en su lugar
    d.row.style.transform = 'translateY(' + (d.target - d.index) * d.step + 'px)';
    setTimeout(() => {
      document.body.classList.remove('reordering');
      if (d.target !== d.index) {
        const moved = CATS.splice(d.index, 1)[0];
        CATS.splice(d.target, 0, moved);
        persist();
      }
      $('cats').innerHTML = ''; // filas nuevas, sin los desplazamientos del arrastre
      renderMain();
    }, 220);
  }

  document.addEventListener('pointermove', (e) => {
    if (drag) { drag.clientY = e.clientY; updateDrag(); e.preventDefault(); }
    else if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress(); // se movió más de 8 px: era scroll
  });
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { if (drag) endDrag(); else cancelPress(); }));
  document.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
  $('cats').addEventListener('contextmenu', (e) => e.preventDefault());
  // Al soltar después de arrastrar no se debe contar como un toque para filtrar
  document.addEventListener('click', (e) => { if (justDragged) { e.stopPropagation(); e.preventDefault(); justDragged = false; } }, true);

  // Con teclado: Alt + flecha arriba/abajo mueve la categoría enfocada
  $('cats').addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const btn = e.target.closest('.cat-select');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.cat;
    const i = CATS.findIndex((c) => c.id === id);
    const k = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (k < 0 || k >= CATS.length) return;
    const t = CATS[i]; CATS[i] = CATS[k]; CATS[k] = t;
    persist();
    renderMain();
    const again = $('cats').querySelector('.cat-select[data-cat="' + id + '"]');
    if (again) again.focus();
  });

  /* ---------- eventos ---------- */
  // Un solo listener de clic para toda la app: cada botón tiene data-action y acá se decide qué hace.
  // Más abajo, los listeners de los campos (monto, descripción, fecha) y la tecla Escape.
  document.addEventListener('click', (ev) => {
    const periodBtn = ev.target.closest('[data-period]');
    if (periodBtn) {
      state.filterOpen = false; state.accOpen = false;
      if (periodBtn.dataset.period === state.period) { // segundo toque: abre o cierra el calendario
        if (state.pickOpen) state.pickOpen = false; else openPeriodPicker();
        renderMain();
        return;
      }
      // primer toque: va al día, mes o año actual
      state.period = periodBtn.dataset.period; state.ref = daysAgo(0); state.pickOpen = false; state.showAll = false;
      renderMain(true);
      return;
    }

    const el = ev.target.closest('[data-action]');
    if (el && !el.dataset.action.startsWith('cal-')) state.pickOpen = false; // cualquier otra acción cierra el calendario
    if (!el) {
      if (ev.target.closest('#periodPicker, #accMenu')) return;
      if (state.accOpen) { closeAccount(); return; } // clic afuera cierra el menú de cuenta
      if (state.pickOpen) { state.pickOpen = false; renderMain(); } // clic afuera cierra el calendario
      else if (state.filterOpen) { state.filterOpen = false; renderMain(); } // clic afuera cierra el filtro
      // tocar el fondo vacío quita la categoría seleccionada
      else if (state.cat !== 'all' && !state.sheet && $('catRoot').hidden && $('delRoot').hidden && $('budRoot').hidden && $('repRoot').hidden && $('impRoot').hidden && $('curRoot').hidden && $('wipeRoot').hidden && !$('home').hidden &&
               !ev.target.closest('button, input, a, label')) {
        state.cat = 'all'; state.showAll = false; renderMain();
      }
      return;
    }
    lastTrigger = el;
    // cualquier otro botón cierra los menús abiertos (las opciones de cada menú lo cierran ellas mismas)
    const action = el.dataset.action;
    if ((state.accOpen || state.filterOpen) && action !== 'toggle-account' && action !== 'toggle-filter' && !el.closest('#accMenu, #filterMenu')) {
      state.accOpen = false; state.filterOpen = false;
      renderMain();
    }
    switch (action) {
      case 'open-new': openSheet('new'); break;                 // "Agregar gasto"
      case 'open-budget': openBudget(); break;                  // "Definir / Editar presupuesto"
      case 'close-budget': closeBudget(); break;
      case 'save-budget': saveBudget(); break;
      case 'remove-budget': removeBudget(); break;              // "Eliminar presupuesto"
      case 'open-report': openReport(); break;                  // "Descargar informe" al lado del filtro
      case 'close-report': closeReport(); break;
      case 'report-scope': state.report.scope = el.dataset.scope; syncReport(); break; // Todo / Por categorías
      case 'toggle-report-cat': // categorías del informe, se pueden marcar varias
        if (state.report.cats[el.dataset.cat]) delete state.report.cats[el.dataset.cat]; else state.report.cats[el.dataset.cat] = true;
        syncReport(); break;
      case 'download-report': downloadReport(); break;          // "Descargar PDF"
      case 'toggle-repeat': el.setAttribute('aria-checked', !repeating()); syncRepeat(); break; // interruptor "Repetir todos los meses"
      case 'open-cat': openCat(); break;                        // "Nueva categoría"
      case 'edit-cat': openCat(el.dataset.cat); break;          // lápiz de la categoría seleccionada
      case 'select-cat': // tocar una categoría la filtra; tocarla de nuevo vuelve a todas
        state.cat = state.cat === el.dataset.cat ? 'all' : el.dataset.cat; state.showAll = false; renderMain(); break;
      case 'close-cat': closeCat(); break;
      case 'save-cat': saveCat(); break;
      case 'ask-delete-cat': openDeleteCat(el.dataset.cat); break; // tacho de la categoría seleccionada
      case 'close-delete-cat': closeDeleteCat(); break;
      case 'confirm-delete-cat': deleteCat(); break;
      case 'pick-icon': // ícono en la hoja de categoría
        catIcon = Number(el.dataset.icon); renderCatIcons(); syncCat(); $('catIcons').querySelector('[data-icon="' + catIcon + '"]').focus(); break;
      case 'open-edit': // tocar un gasto de la lista
        openSheet('edit', state.expenses.find((e) => e.id === el.dataset.id)); break;
      case 'close-sheet': closeSheet(); break;
      case 'save': save(); break;
      case 'delete': remove(); break;                           // "Eliminar gasto"
      case 'toggle-filter': // botón "Todas las categorías"
        state.filterOpen = !state.filterOpen; state.accOpen = false; renderMain(); break;
      case 'toggle-account': // el saludo: abre o cierra el menu de cuenta
        if (state.accOpen) closeAccount(); else { state.accOpen = true; state.filterOpen = false; renderMain(); }
        break;
      case 'export-data': exportData(); break;
      case 'open-import': openImport(); break;
      case 'close-import': closeImport(); break;
      case 'pick-import': $('importFile').click(); break;       // "Elegir archivo" (abre el selector del input oculto)
      case 'open-currency': openCurrency(); break;
      case 'close-currency': closeCurrency(); break;
      case 'pick-currency': pickCurrency(el.dataset.cur); break; // una moneda de la lista
      case 'feedback': closeAccount(); break; // reportar un problema: el link se abre solo en otra pestaña, acá solo se cierra el menú
      case 'logout': logout(); break;
      case 'open-wipe': openWipe(); break;                      // "Borrar mis datos"
      case 'close-wipe': closeWipe(); break;
      case 'confirm-wipe': wipe(); break;                       // "Borrar todo"
      case 'pick-filter': // una opción del menú de categorías
        state.cat = el.dataset.cat; state.filterOpen = false; state.showAll = false; renderMain(); break;
      case 'toggle-all': toggleRecent(); break;                 // "Ver todas" / "Ver menos"
      case 'toggle-picker': // chip de categoría en la hoja del gasto
        state.draft.pickerOpen = !state.draft.pickerOpen; syncSheet(); break;
      case 'pick-cat': // categoría elegida a mano en la hoja del gasto
        state.draft.manualCat = el.dataset.cat; state.draft.pickerOpen = false; syncSheet(); break;
      case 'cal-nav': // flechas del calendario
        navPicker(Number(el.dataset.dir)); renderPicker(); break;
      case 'cal-pick': // un día, mes o año del calendario, o "Volver a hoy"
        state.ref = el.dataset.value; state.pickOpen = false; state.showAll = false; renderMain(true); break;
    }
  });

  // Campos: fecha del gasto, montos (al pegar y al tipear), descripción y nombre de categoría
  $('expDate').addEventListener('change', (e) => {
    const v = e.target.value;
    if (isValidDate(v) && v <= daysAgo(0)) state.draft.date = v; // si la borran o es futura, queda la anterior
    syncDate();
  });
  // en compu el calendario solo se abría tocando el iconito: showPicker lo abre tocando en cualquier parte
  $('expDate').addEventListener('click', (e) => { try { e.target.showPicker(); } catch (err) { /* el navegador lo abre solo */ } });
  // al pegar se entienden los centavos ("1.500,50"); al tipear solo valen los dígitos
  $('amount').addEventListener('paste', (e) => {
    e.preventDefault();
    state.draft.digits = parseAmount(e.clipboardData.getData('text'));
    e.target.value = dots(state.draft.digits);
    syncSheet();
  });
  $('budgetAmount').addEventListener('paste', (e) => {
    e.preventDefault();
    e.target.value = dots(parseAmount(e.clipboardData.getData('text')));
    syncBudget();
  });
  $('amount').addEventListener('input', (e) => {
    state.draft.digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    e.target.value = dots(state.draft.digits);
    syncSheet();
  });
  $('budgetAmount').addEventListener('input', (e) => { // solo números, con puntos de miles
    e.target.value = dots(budgetDigits().replace(/^0+/, '').slice(0, 9));
    syncBudget();
  });
  $('budgetAmount').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBudget(); });
  $('importFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; importFile(f); });
  // sin emojis en nombres y descripciones (isComposing: no tocar mientras se arma una letra con tilde)
  $('catName').addEventListener('input', (e) => { if (!e.isComposing) keepLatin(e.target); syncCat(); });
  $('catName').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCat(); });
  $('desc').addEventListener('input', (e) => { if (!e.isComposing) keepLatin(e.target); state.draft.desc = e.target.value; syncSheet(); });
  $('desc').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  $('amount').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('desc').focus(); });
  // Escape cierra lo que esté más arriba: primero los diálogos del menu de cuenta, después el menú, después las hojas
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('wipeRoot').hidden) { closeWipe(); return; }
    if (!$('impRoot').hidden) { closeImport(); return; }
    if (!$('curRoot').hidden) { closeCurrency(); return; }
    if (state.accOpen) { closeAccount(true); return; }
    if (!$('repRoot').hidden) { closeReport(); return; }
    if (!$('catRoot').hidden) { closeCat(); return; }
    if (!$('delRoot').hidden) { closeDeleteCat(); return; }
    if (!$('budRoot').hidden) { closeBudget(); return; }
    if (state.sheet) closeSheet();
    else if (state.pickOpen) { state.pickOpen = false; renderMain(); }
    else if (state.filterOpen) { state.filterOpen = false; renderMain(); }
    else if (state.cat !== 'all' && !$('home').hidden) { state.cat = 'all'; state.showAll = false; renderMain(); }
  });

  /* ---------- ingreso ---------- */
  // Pantalla de iniciar sesión o registrarse. No hay servidor: solo se pide completar los campos y el nombre queda
  // en sessionStorage (se borra al cerrar la pestaña). showHome pasa a la pantalla principal.
  const SESSION_KEY = 'berde.user';
  const TOAST_KEY = 'berde.toast'; // aviso para mostrar después de recargar (por ejemplo "Datos importados")
  const getUser = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; } };

  // Pasa a la pantalla principal; con animate, el ingreso se desvanece antes
  function showHome(name, animate) {
    $('greeting').textContent = '¡Hola, ' + name + '!';
    $('accName').textContent = name;
    const login = $('login');
    const home = $('home');
    const reveal = () => {
      login.classList.remove('leaving');
      login.hidden = true;
      home.hidden = false;
      home.classList.add('enter');
      placeThumb($('periodGroup'), true);
      window.scrollTo(0, 0);
    };
    if (animate && !login.hidden) {
      login.classList.add('leaving');
      setTimeout(reveal, 280);
    } else {
      reveal();
    }
  }

  let mode = 'login';
  // Pestañas Iniciar sesión / Registrarse: en registrarse aparece "Repetir contraseña"
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    document.querySelectorAll('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    placeThumb(document.querySelector('.auth-tabs'));
    slide($('confirmField'), m === 'register'); // "Repetir contraseña" se abre o se cierra deslizando
    swapLabel($('authBtn'), m === 'register' ? 'Crear cuenta' : 'Ingresar');
    $('pass').autocomplete = m === 'register' ? 'new-password' : 'current-password';
    $('loginError').hidden = true;
  }
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  function authError(text) { $('loginError').textContent = text; $('loginError').hidden = false; }

  // El usuario es solo un nombre (con tildes, espacios, guion o apóstrofo), no un correo: se usa para el saludo
  const NAME_RE = /^\p{L}[\p{L} '-]*$/u;
  const NAME_ERROR = 'Ingresá solo tu nombre, sin correo ni símbolos.';

  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = $('user').value.trim().replace(/\s+/g, ' ');
    const p = $('pass').value;
    if (!u || !p || (mode === 'register' && !$('pass2').value)) { authError('Completá todos los campos.'); return; }
    if (!NAME_RE.test(u)) { authError(NAME_ERROR); $('user').focus(); return; }
    if (mode === 'register' && p !== $('pass2').value) { authError('Las contraseñas no coinciden.'); return; }
    const name = u.charAt(0).toUpperCase() + u.slice(1);
    try { sessionStorage.setItem(SESSION_KEY, name); } catch (err) { /* ignorar */ }
    showHome(name, true);
  });
  ['user', 'pass', 'pass2'].forEach((id) => $(id).addEventListener('input', () => { $('loginError').hidden = true; }));
  $('user').addEventListener('input', (e) => { if (e.target.value.includes('@')) authError(NAME_ERROR); }); // avisa apenas parece un correo

  /* ---------- cambio de dia ---------- */
  // Si la app queda abierta pasada la medianoche, "hoy" pasa al día nuevo (syncToday). Solo se mueve la vista
  // si estaba en hoy; si el usuario miraba otra fecha, queda ahí. Se revisa al volver a la pestaña y cada minuto.
  let lastToday = daysAgo(0);
  function syncToday() {
    const today = daysAgo(0);
    if (today === lastToday) return;
    if (state.ref === lastToday) state.ref = today;
    lastToday = today;
    renderMain();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncToday(); });
  window.addEventListener('focus', syncToday);
  setInterval(syncToday, 60000);

  /* ---------- arranque ---------- */
  // Lo que corre al abrir la app: cargar datos, dibujar, y después de la pantalla de inicio (2 s) mostrar el ingreso o la app.
  load();
  applyOrder();
  syncCurrency();
  $('accVersion').textContent = 'Versión ' + APP_VERSION;
  // Link de reportar un problema: el formulario llega con la versión y el dispositivo completos.
  // Nunca se manda nada de los gastos. El userAgent se corta en 300 para que el link no quede gigante.
  const feedbackHref = FEEDBACK_URL + '?usp=pp_url' +
    '&' + FEEDBACK_ENTRY_VERSION + '=' + encodeURIComponent(APP_VERSION) +
    '&' + FEEDBACK_ENTRY_DEVICE + '=' + encodeURIComponent(navigator.userAgent.slice(0, 300));
  $('accFeedback').href = feedbackHref;
  $('accFeedback').hidden = false;
  renderMain();

  setTimeout(() => {
    const splash = $('splash');
    splash.classList.add('out');
    const user = getUser();
    if (user) showHome(user);
    // aviso que quedó pendiente antes de recargar (por ejemplo al importar)
    let pending = null;
    try { pending = sessionStorage.getItem(TOAST_KEY); sessionStorage.removeItem(TOAST_KEY); } catch (e) { /* ignorar */ }
    if (pending) toast(pending);
    if (!user) { $('login').hidden = false; placeThumb(document.querySelector('.auth-tabs'), true); $('user').focus(); }
    setTimeout(() => splash.remove(), 450);
  }, 2000);
})();
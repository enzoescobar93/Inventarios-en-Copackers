/* ============================================================
   TABLERO COPACKERS — motor de extracción (portado desde Python)
   Lee el .xlsx en el navegador (SheetJS) y reproduce exactamente
   la misma lógica de agregación, correcciones y rankings que se
   usó para armar el HTML original.
   ============================================================ */

const ANIO_FIJO = null; // si es null, se autodetecta como el año del "mes activo"

function ymKey(y, m) { return y + '-' + String(m).padStart(2, '0'); }

function cellDateToYM(v) {
  // SheetJS con cellDates:true devuelve objetos Date para celdas de fecha
  if (v instanceof Date && !isNaN(v)) return { y: v.getFullYear(), m: v.getMonth() + 1 };
  return null;
}

function sheetToAOA(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

/**
 * Lee una hoja "Resumen X" (Ajustes/Consumos/Stocks/ingresos).
 * Columna A=Código, D=Copacker, F:X (idx 5..23, 0-based) = $ por mes.
 * Devuelve: { rows: [{codigo, copacker, vals:{ 'YYYY-MM': valor }}], months: ['YYYY-MM',...] }
 */
function readResumenSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], months: [] };
  const aoa = sheetToAOA(ws);
  const header = aoa[0] || [];
  const dateCols = []; // {idx, y, m}
  for (let c = 5; c <= 23 && c < header.length; c++) { // F..X => idx 5..23 (0-based), cap at col X
    const ym = cellDateToYM(header[c]);
    if (ym) dateCols.push({ idx: c, y: ym.y, m: ym.m });
  }
  const rows = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const codigo = row[0];
    const copacker = row[3];
    if (copacker === null || copacker === undefined || copacker === '') continue;
    const vals = {};
    dateCols.forEach(dc => {
      let v = row[dc.idx];
      if (typeof v !== 'number') v = 0;
      vals[ymKey(dc.y, dc.m)] = v;
    });
    rows.push({ codigo, copacker, vals });
  }
  const months = dateCols.map(dc => ymKey(dc.y, dc.m));
  return { rows, months };
}

function aggregateByCopacker(rows) {
  const out = {};
  rows.forEach(({ copacker, vals }) => {
    const d = out[copacker] || (out[copacker] = {});
    Object.keys(vals).forEach(k => { d[k] = (d[k] || 0) + vals[k]; });
  });
  return out;
}

function totalsAll(byCop) {
  const out = {};
  Object.values(byCop).forEach(d => {
    Object.keys(d).forEach(k => { out[k] = (out[k] || 0) + d[k]; });
  });
  return out;
}

/**
 * Lee la hoja "BD MOVIMIENTOS" y "BD Stocks" solo para calcular el "mes activo"
 * (MAX de Fecha MES / Fecha), igual que la fórmula del Excel: no depende de
 * ninguna celda puntual del KPI Dashboard, así que es robusta a que reordenen
 * la hoja.
 */
function computeMesActivo(wb) {
  let maxTs = null;
  ['BD MOVIMIENTOS', 'BD Stocks'].forEach(name => {
    const ws = wb.Sheets[name];
    if (!ws) return;
    const ref = ws['!ref'];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    // BD MOVIMIENTOS: fecha MES está en col R (idx 17). BD Stocks: Fecha está en col A (idx 0).
    const colIdx = name === 'BD MOVIMIENTOS' ? 17 : 0;
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: colIdx });
      const cell = ws[addr];
      if (cell && cell.v instanceof Date) {
        const ts = cell.v.getTime();
        if (maxTs === null || ts > maxTs) maxTs = ts;
      } else if (cell && cell.t === 'n' && cell.w) {
        // fallback: fecha numérica de Excel sin cellDates -- poco común, se ignora
      }
    }
  });
  if (maxTs === null) return null;
  const d = new Date(maxTs);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function readCopackers(wb) {
  const ws = wb.Sheets['Data '] || wb.Sheets['Data'];
  if (!ws) return [];
  const aoa = sheetToAOA(ws);
  const list = [];
  for (let r = 1; r < aoa.length; r++) {
    const name = aoa[r] && aoa[r][1];
    if (name) list.push(name);
    else if (list.length >= 13) break;
  }
  return list;
}

function readCronograma(wb) {
  const ws = wb.Sheets['Cronograma de conteos'];
  if (!ws) return [];
  const aoa = sheetToAOA(ws);
  const out = [];
  for (let r = 2; r < aoa.length; r++) { // fila 3 en Excel = idx 2
    const row = aoa[r];
    if (!row) continue;
    const copacker = row[0]; // A
    const frecuencia = row[1]; // B
    const nota = row[14]; // O
    if (copacker) out.push({ copacker, frecuencia: frecuencia || 'Mensual', nota: nota || null });
  }
  return out;
}

function buildSection(anio, mesActivo, ajustesD, consumosD, stocksD, ingresosD) {
  const evo = [];
  for (let m = 1; m <= 12; m++) {
    const key = ymKey(anio, m);
    const aj = ajustesD[key] || 0;
    const co = consumosD[key] || 0;
    const st = stocksD[key] || 0;
    evo.push({
      mes: key, ajustes: aj, consumo: co,
      indice_consumo: co ? (-aj / co) : 0,
      stock: st, indice_stock: st ? (aj / st) : 0,
    });
  }
  const totAj = evo.reduce((s, e) => s + e.ajustes, 0);
  const totCo = evo.reduce((s, e) => s + e.consumo, 0);
  const mesActivoKey = mesActivo ? ymKey(mesActivo.y, mesActivo.m) : null;
  const mesesConDatos = evo.filter(e => mesActivoKey && e.mes <= mesActivoKey).map(e => e.stock);
  const stockProm = mesesConDatos.length ? mesesConDatos.reduce((a, b) => a + b, 0) / mesesConDatos.length : 0;
  const evoTotal = {
    ajustes: totAj, consumo: totCo,
    indice_consumo: totCo ? (-totAj / totCo) : 0,
    stock: stockProm, indice_stock: stockProm ? (totAj / stockProm) : 0,
  };
  const mAj = mesActivoKey ? (ajustesD[mesActivoKey] || 0) : 0;
  const mCo = mesActivoKey ? (consumosD[mesActivoKey] || 0) : 0;
  const mSt = mesActivoKey ? (stocksD[mesActivoKey] || 0) : 0;
  const kpiMes = {
    ajustes: mAj, consumo: mCo, indice_consumo: mCo ? (-mAj / mCo) : 0,
    stock: mSt, indice_stock: mSt ? (mAj / mSt) : 0,
  };
  let ingresosAnio = 0, consumosAnio = 0, ajustesAnio = 0;
  Object.keys(ingresosD).forEach(k => { if (k.startsWith(anio + '-')) ingresosAnio += ingresosD[k]; });
  Object.keys(consumosD).forEach(k => { if (k.startsWith(anio + '-')) consumosAnio += consumosD[k]; });
  Object.keys(ajustesD).forEach(k => { if (k.startsWith(anio + '-')) ajustesAnio += ajustesD[k]; });
  const indiceAnio = consumosAnio ? (-ajustesAnio / consumosAnio) : 0;
  const indiceStockProm = stockProm ? (ajustesAnio / stockProm) : 0;
  return {
    evolucion_mensual: evo, evolucion_total: evoTotal, kpi_mes: kpiMes,
    ingresos_totales: ingresosAnio, consumos_totales: consumosAnio,
    ajustes_totales_anio: ajustesAnio, indice_ajuste_anio: indiceAnio,
    stock_promedio_ytd: stockProm, indice_ajuste_stock_promedio: indiceStockProm,
  };
}

function readResultados(wb) {
  const ws = wb.Sheets['Resultados'];
  if (!ws) return [];
  const aoa = sheetToAOA(ws);
  const rows = [];
  for (let r = 2; r < aoa.length; r++) { // fila 3 = idx 2
    const row = aoa[r];
    if (!row) continue;
    const codigo = row[0]; // A
    if (codigo === null || codigo === undefined || codigo === '') continue;
    const copacker = row[5]; // F
    const ajusteTotal = row[2] || 0;    // C
    const ajusteAbsTotal = row[50] || 0; // AY (idx 50)
    const ajusteNeto2026 = row[51] || 0; // AZ (idx 51)
    const ajusteAbs2026 = row[52] || 0;  // BA (idx 52)
    const um = row[53];                // BB (idx 53)
    rows.push({
      codigo, descripcion: row[1], copacker,
      ajuste_total: ajusteTotal, ajuste_abs_total: ajusteAbsTotal,
      ajuste_neto_2026: ajusteNeto2026, ajuste_abs_2026: ajusteAbs2026,
      um: um || '',
    });
  }
  return rows;
}

function top20FromSubset(subset, key, reverse) {
  const sorted = [...subset].sort((a, b) => reverse ? (b[key] - a[key]) : (a[key] - b[key]));
  return sorted.slice(0, 20).map((row, i) => ({
    rank: i + 1, codigo: row.codigo, descripcion: row.descripcion,
    copacker: row.copacker, monto: row[key], um: row.um,
  }));
}

function buildTop20Set(subset) {
  return {
    negativo: {
      title: 'Top 20 materiales con mayor Ajuste NETO NEGATIVO 2026',
      rows: top20FromSubset(subset, 'ajuste_neto_2026', false),
    },
    positivo: {
      title: 'Top 20 materiales con mayor Ajuste NETO POSITIVO 2026',
      rows: top20FromSubset(subset, 'ajuste_neto_2026', true),
    },
    absoluto: {
      title: 'Top 20 materiales con mayor Ajuste 2026 (valor absoluto)',
      rows: top20FromSubset(subset, 'ajuste_abs_2026', true).map(r => ({ ...r, monto: Math.abs(r.monto) })),
    },
    todo_periodo: {
      title: 'Top 20 materiales con mayor Ajuste acumulado (valor absoluto, todo el período)',
      rows: top20FromSubset(subset, 'ajuste_abs_total', true).map(r => {
        const src = subset.find(x => x.codigo === r.codigo && x.copacker === r.copacker);
        return { ...r, monto: src ? src.ajuste_total : r.monto };
      }),
    },
  };
}

/**
 * Punto de entrada principal: recibe el ArrayBuffer del .xlsx subido
 * y devuelve el mismo objeto DATA que consume el dashboard.
 */
function buildDashboardData(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const { rows: ajustesRows } = readResumenSheet(wb, 'Resumen Ajustes');
  const { rows: consumosRows } = readResumenSheet(wb, 'Resumen Consumos');
  const { rows: stocksRows } = readResumenSheet(wb, 'Resumen Stocks');
  const { rows: ingresosRows } = readResumenSheet(wb, 'Resumen ingresos');

  const ajustesByCop = aggregateByCopacker(ajustesRows);
  const consumosByCop = aggregateByCopacker(consumosRows);
  const stocksByCop = aggregateByCopacker(stocksRows);
  const ingresosByCop = aggregateByCopacker(ingresosRows);

  const ajustesTodos = totalsAll(ajustesByCop);
  const consumosTodos = totalsAll(consumosByCop);
  const stocksTodos = totalsAll(stocksByCop);
  const ingresosTodos = totalsAll(ingresosByCop);

  const mesActivo = computeMesActivo(wb);
  const anio = ANIO_FIJO || (mesActivo ? mesActivo.y : new Date().getFullYear());
  const copackers = readCopackers(wb);

  const sections = {};
  sections['Todos'] = buildSection(anio, mesActivo, ajustesTodos, consumosTodos, stocksTodos, ingresosTodos);
  copackers.forEach(cop => {
    sections[cop] = buildSection(
      anio, mesActivo,
      ajustesByCop[cop] || {}, consumosByCop[cop] || {},
      stocksByCop[cop] || {}, ingresosByCop[cop] || {}
    );
  });

  const ajustesPorCopacker = copackers.map(cop => {
    const d = ajustesByCop[cop] || {};
    let total = 0;
    Object.keys(d).forEach(k => { if (k.startsWith(anio + '-')) total += d[k]; });
    return { copacker: cop, ajuste: total };
  });
  const ajustesTotal = ajustesPorCopacker.reduce((s, c) => s + c.ajuste, 0);

  const resultadosRows = readResultados(wb);
  const top20 = { Todos: buildTop20Set(resultadosRows) };
  copackers.forEach(cop => {
    top20[cop] = buildTop20Set(resultadosRows.filter(r => r.copacker === cop));
  });

  const cronograma = readCronograma(wb);

  return {
    anio_activo: anio,
    mes_activo: mesActivo ? ymKey(mesActivo.y, mesActivo.m) : null,
    copackers, sections,
    ajustes_por_copacker: ajustesPorCopacker,
    ajustes_total: ajustesTotal,
    top20, cronograma,
    generado: new Date().toISOString(),
  };
}

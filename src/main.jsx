import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Trophy, Target, TrendingUp, Percent, Medal, RefreshCcw, Search, Crown, CalendarDays } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import './styles.css'

const SHEET_ID = '1g3jc06lKdf2wczWF8RfBHsvBvXcnwZvBN57pr5o8H58'
const LEAGUES = [
  { label: 'NBA', sheet: 'NBA' },
  { label: 'MLB', sheet: 'MLB' },
  { label: 'FREE', sheet: 'free' }
]

const RESULT_COLORS = {
  ganada: '#2ee59d',
  perdida: '#ff3b30',
  nula: '#2f80ed',
  pendiente: '#f4c542',
  otro: '#8b8b96'
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseNumber(value) {
  if (value === null || value === undefined) return 0
  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function readCell(cell, colName) {
  if (!cell) return ''

  // Para fechas conviene usar el valor crudo de Google Visualization API.
  // El valor formateado a veces llega como "abril" o "mayo" y el navegador lo puede interpretar mal como año 2001.
  if (colName === 'Fecha') return cell.v ?? cell.f ?? ''

  return cell.f ?? cell.v ?? ''
}

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  const text = String(value).trim()
  const normalized = normalizeKey(text)

  const months = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
    september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
  }

  // Google Sheets / Visualization API: Date(2026,4,29). Mes viene base 0.
  const gvizDate = text.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})\)/)
  if (gvizDate) {
    const [, y, m, d] = gvizDate
    return new Date(Number(y), Number(m), Number(d))
  }

  // Formatos tipo 29 mayo 2026 o 29 de mayo de 2026.
  const spanish = normalized.match(/(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})/i)
  if (spanish) {
    const [, d, m, y] = spanish
    const monthIndex = months[m]
    if (monthIndex !== undefined) return new Date(Number(y), monthIndex, Number(d))
  }

  // Formatos numéricos: 29/05/2026 o 29-05-26.
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (slash) {
    const [, d, m, y] = slash
    return new Date(Number(y.length === 2 ? `20${y}` : y), Number(m) - 1, Number(d))
  }

  // Serial de Google/Excel cuando la fecha llega como número.
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text)
    if (serial > 20000 && serial < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30))
      return new Date(epoch.getTime() + serial * 86400000)
    }
  }

  // Evita que "mayo" o "abril" se conviertan por accidente en fechas de 2001.
  if (months[normalized] !== undefined) return null

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return new Date(Number(y), Number(m) - 1, Number(d))
  }

  return null
}

function dateTime(value) {
  return parseDate(value)?.getTime() || 0
}

function isClosedBet(row) {
  const result = normalizeKey(row?.resultado)

  return [
    'ganada',
    'ganado',
    'win',
    'won',
    'perdida',
    'perdido',
    'loss',
    'lost',
    'nula',
    'push',
    'void',
    'cancelada',
    'cancelado'
  ].includes(result)
}

function formatDate(value) {
  const date = parseDate(value)
  if (!date) return value || '-'
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function monthKey(value) {
  const date = parseDate(value)
  if (!date) return 'Sin fecha'
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(date)
}

function currentMonthKey() {
  return monthKey(new Date())
}

function leagueToSheetName(leagueLabel) {
  return LEAGUES.find(item => item.label === leagueLabel)?.sheet || leagueLabel
}

function extractMarketCategory(value, league) {
  const text = normalizeKey(value)

  const categories = league === 'MLB'
    ? [
        ['Strikeouts / Ponches', ['strikeout', 'strikeouts', 'ponche', 'ponches', 'ks', ' k ', 'k\'s']],
        ['Bases totales', ['bases totales', 'total bases', 'tb']],
        ['Hits', [' hit', 'hits', 'sencillo']],
        ['Carreras', ['carreras', 'runs']],
        ['Carreras impulsadas', ['carreras impulsadas', 'rbi', 'rbis', 'impulsadas']],
        ['Home runs', ['home run', 'homerun', 'jonron', 'hr']],
        ['Bases robadas', ['base robada', 'bases robadas', 'stolen base', 'sb']],
        ['Walks / Boletos', ['walk', 'walks', 'boletos', 'base por bola', 'bb']]
      ]
    : [
        ['Puntos', ['puntos', 'points', 'pts']],
        ['Rebotes', ['rebotes', 'rebounds', 'rebs', 'reb']],
        ['Asistencias', ['asistencias', 'assists', 'asts', 'ast']],
        ['PRA', ['pra', 'puntos rebotes asistencias', 'points rebounds assists']],
        ['Puntos + Rebotes', ['puntos + rebotes', 'points + rebounds', 'pts+reb', 'pr']],
        ['Puntos + Asistencias', ['puntos + asistencias', 'points + assists', 'pts+ast', 'pa']],
        ['Rebotes + Asistencias', ['rebotes + asistencias', 'rebounds + assists', 'reb+ast', 'ra']],
        ['Triples', ['triples', '3pt', '3pts', 'threes', '3-pointers']],
        ['Robos', ['robos', 'steals', 'stl']],
        ['Bloqueos', ['bloqueos', 'blocks', 'blk']],
        ['Pérdidas', ['perdidas', 'turnovers', 'to']]
      ]

  const found = categories.find(([, keys]) => keys.some(key => text.includes(normalizeKey(key))))
  return found ? found[0] : 'Otros mercados'
}

async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo leer Google Sheets. Revisa que la hoja esté pública.')
  const text = await response.text()
  const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1))
  const cols = json.table.cols.map((c) => c.label?.trim() || '')

  return json.table.rows.map((row, index) => {
    const item = {}
    cols.forEach((col, i) => {
      item[col] = readCell(row.c[i], col)
    })
    return {
      id: `${sheetName}-${index}`,
      fecha: item.Fecha,
      partido: item.Partido,
      mercado: item['Jugador + Mercado'],
      stake: parseNumber(item.Stake),
      cuota: parseNumber(item.Cuota),
      resultado: String(item.Resultado || '').trim(),
      profit: parseNumber(item.Profit),
      bankroll: parseNumber(item.Bankroll)
    }
  }).filter((row) => row.fecha || row.partido || row.mercado)
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'gold' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  )
}

function App() {
  const [league, setLeague] = useState('NBA')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [resultFilter, setResultFilter] = useState('Todos')
  const [monthFilter, setMonthFilter] = useState('Todos')

  async function loadData(selected = league) {
    setLoading(true)
    setError('')
    try {
      const data = await fetchSheet(leagueToSheetName(selected))
      setRows(data)
      setMonthFilter('Todos')
      setResultFilter('Todos')
    } catch (err) {
      setError(err.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(league)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league])

  const months = useMemo(() => {
    const unique = Array.from(new Set(rows.map(r => monthKey(r.fecha))))
      .filter(month => month !== 'Sin fecha')
      .sort((a, b) => {
        const sampleA = rows.find(r => monthKey(r.fecha) === a)?.fecha
        const sampleB = rows.find(r => monthKey(r.fecha) === b)?.fecha
        return dateTime(sampleB) - dateTime(sampleA)
      })
    const hasNoDate = rows.some(r => monthKey(r.fecha) === 'Sin fecha')
    const current = currentMonthKey()
    const monthOptions = unique.includes(current) ? unique : [current, ...unique]
    return ['Todos', ...monthOptions, ...(hasNoDate ? ['Sin fecha'] : [])]
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const q = normalizeKey(query)
      const matchesQuery = !q || normalizeKey(`${row.partido} ${row.mercado}`).includes(q)
      const matchesResult = resultFilter === 'Todos' || normalizeKey(row.resultado) === normalizeKey(resultFilter)
      const matchesMonth = monthFilter === 'Todos' || monthKey(row.fecha) === monthFilter
      return matchesQuery && matchesResult && matchesMonth
    })
  }, [rows, query, resultFilter, monthFilter])

  const tableRows = useMemo(() => {
    return [...filtered].sort((a, b) => dateTime(b.fecha) - dateTime(a.fecha))
  }, [filtered])

  const stats = useMemo(() => {
    // Para métricas de rentabilidad solo se cuentan apuestas cerradas.
    // Esto evita sumar picks pendientes que tengan un valor provisional en Profit,
    // que era lo que hacía que NBA mostrara 2 unidades de más.
    const closed = filtered.filter(isClosedBet)
    const resolved = closed.filter(r => ['ganada', 'ganado', 'win', 'won', 'perdida', 'perdido', 'loss', 'lost'].includes(normalizeKey(r.resultado)))
    const wins = closed.filter(r => ['ganada', 'ganado', 'win', 'won'].includes(normalizeKey(r.resultado))).length
    const losses = closed.filter(r => ['perdida', 'perdido', 'loss', 'lost'].includes(normalizeKey(r.resultado))).length
    const push = closed.filter(r => ['nula', 'push', 'void', 'cancelada', 'cancelado'].includes(normalizeKey(r.resultado))).length
    const pending = filtered.filter(r => ['pendiente', 'pending'].includes(normalizeKey(r.resultado))).length
    const totalProfit = closed.reduce((sum, row) => sum + row.profit, 0)
    const totalStake = closed.reduce((sum, row) => sum + row.stake, 0)
    const avgOdds = closed.length ? closed.reduce((sum, row) => sum + row.cuota, 0) / closed.length : 0
    return {
      totalProfit,
      totalStake,
      yieldValue: totalStake ? (totalProfit / totalStake) * 100 : 0,
      winrate: resolved.length ? (wins / resolved.length) * 100 : 0,
      avgOdds,
      wins,
      losses,
      push,
      pending
    }
  }, [filtered])

  const lineData = useMemo(() => {
    let acc = 0
    return [...filtered]
      .filter(isClosedBet)
      .sort((a, b) => dateTime(a.fecha) - dateTime(b.fecha))
      .map((row) => {
        acc += row.profit
        return { fecha: formatDate(row.fecha), profit: Number(acc.toFixed(2)), diario: row.profit }
      })
  }, [filtered])

  const pieData = [
    { name: 'Ganadas', value: stats.wins, key: 'ganada' },
    { name: 'Perdidas', value: stats.losses, key: 'perdida' },
    { name: 'Nulas', value: stats.push, key: 'nula' },
    { name: 'Pendientes', value: stats.pending, key: 'pendiente' }
  ].filter(item => item.value > 0)

  const marketData = useMemo(() => {
    const map = new Map()
    filtered.filter(isClosedBet).forEach(row => {
      const key = extractMarketCategory(row.mercado, league)
      map.set(key, (map.get(key) || 0) + row.profit)
    })
    return Array.from(map, ([mercado, profit]) => ({ mercado, profit: Number(profit.toFixed(2)) }))
      .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
      .slice(0, 10)
  }, [filtered, league])

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-overlay" />
        <img className="logo-goat" src="./la-cabra-logo.jpg" alt="La Cabra NBA" />
        <div className="hero-content">
          <div className="eyebrow"><Crown size={18} /> Dashboard profesional</div>
          <h1>LA CABRA <span>{league}</span></h1>
          <p>Control de apuestas deportivas conectado a Google Sheets. Disciplina, gestión y ganancias.</p>
          <div className="league-switch">
            {LEAGUES.map(item => (
              <button key={item.label} className={league === item.label ? 'active' : ''} onClick={() => setLeague(item.label)}>{item.label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="toolbar glass-panel">
        <div className="input-wrap"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar partido, jugador o mercado" /></div>
        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>{months.map(m => <option key={m}>{m}</option>)}</select>
        <select value={resultFilter} onChange={e => setResultFilter(e.target.value)}>{['Todos', 'Ganada', 'Perdida', 'Nula', 'Pendiente'].map(r => <option key={r}>{r}</option>)}</select>
        <button className="refresh" onClick={() => loadData()}><RefreshCcw size={17} /> Actualizar</button>
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="metrics-grid">
        <MetricCard icon={Trophy} label="Profit" value={`${stats.totalProfit.toFixed(2)} u`} tone={stats.totalProfit >= 0 ? 'green' : 'red'} />
        <MetricCard icon={Percent} label="Yield" value={`${stats.yieldValue.toFixed(2)}%`} tone={stats.yieldValue >= 0 ? 'green' : 'red'} />
        <MetricCard icon={Target} label="Winrate" value={`${stats.winrate.toFixed(2)}%`} hint={`${stats.wins}G / ${stats.losses}P`} tone="gold" />
        <MetricCard icon={Medal} label="Cuota promedio" value={stats.avgOdds.toFixed(2)} tone="gold" />
      </section>

      <section className="charts-grid">
        <div className="chart-card wide">
          <div className="card-title"><CalendarDays size={18} /><h2>Profit acumulado</h2></div>
          {loading ? <div className="loading">Cargando datos...</div> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                <XAxis dataKey="fecha" stroke="#a9abb7" tick={{ fontSize: 12 }} />
                <YAxis stroke="#a9abb7" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#10131a', border: '1px solid #d9a52b', borderRadius: 12 }} />
                <Line type="monotone" dataKey="profit" stroke="#2ee59d" strokeWidth={4} dot={{ r: 3 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-card">
          <div className="card-title"><Target size={18} /><h2>Resultados</h2></div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={115} paddingAngle={3} animationDuration={900}>
                {pieData.map((entry) => <Cell key={entry.name} fill={RESULT_COLORS[entry.key]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#10131a', border: '1px solid #d9a52b', borderRadius: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card wide market-chart-card">
          <div className="card-title"><TrendingUp size={18} /><h2>Mercados por profit</h2></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={marketData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="mercado" stroke="#a9abb7" tick={{ fontSize: 11 }} />
              <YAxis stroke="#a9abb7" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#10131a', border: '1px solid #d9a52b', borderRadius: 12 }} />
              <Bar dataKey="profit" fill="#d9a52b" radius={[10, 10, 0, 0]} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="table-card">
        <div className="table-head">
          <h2>Registro de picks</h2>
          <span>{filtered.length} apuestas</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Partido</th>
                <th>Jugador + Mercado</th>
                <th>Stake</th>
                <th>Cuota</th>
                <th>Resultado</th>
                <th>Profit</th>
                <th>Bankroll</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(row => {
                const result = normalizeKey(row.resultado) || 'otro'
                return (
                  <tr key={row.id}>
                    <td>{formatDate(row.fecha)}</td>
                    <td>{row.partido}</td>
                    <td className="market-cell">{row.mercado}</td>
                    <td>{row.stake.toFixed(2)}</td>
                    <td>{row.cuota.toFixed(2)}</td>
                    <td><span className={`pill ${result}`}>{row.resultado || '-'}</span></td>
                    <td className={row.profit >= 0 ? 'profit-pos' : 'profit-neg'}>{row.profit.toFixed(2)}</td>
                    <td>{row.bankroll.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)

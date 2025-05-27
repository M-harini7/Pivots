import React, { useState } from 'react'
import Papa from 'papaparse'
import './app.css'

type DataRow = { [key: string]: any }
type PivotCell = { [measure: string]: number[] }
type MeasureConfig = { field: string; agg: 'sum' | 'avg' | 'count' | 'min' | 'max' }

const getQuarter = (month: number): string => {
  if (month < 3) return 'Q1'
  if (month < 6) return 'Q2'
  if (month < 9) return 'Q3'
  return 'Q4'
}

const getMonthName = (month: number): string =>
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month]
function isValidDate(dateString: string): boolean {
  const d = new Date(dateString)
  return !isNaN(d.getTime())
}

function parseRow(row: { [key: string]: string }): DataRow {
  const parsedRow: DataRow = {}
  for (const key in row) {
    const val = row[key].trim()

    if (val === '') {
      parsedRow[key] = ''
    } else if (!isNaN(Number(val))) {
      parsedRow[key] = Number(val)
    } else if (isValidDate(val)) {
      parsedRow[key] = val
      const date = new Date(val)
      parsedRow[`${key}_Year`] = date.getFullYear()
      parsedRow[`${key}_Month`] = getMonthName(date.getMonth())
      parsedRow[`${key}_Quarter`] = getQuarter(date.getMonth())
      parsedRow[`${key}_Day`] = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    } else {
      parsedRow[key] = val
    }
  }
  return parsedRow
}


export default function App() {
  const [data, setData] = useState<DataRow[]>([])
  const [availableFields, setAvailableFields] = useState<string[]>([])
  const [rows, setRows] = useState<string[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [measures, setMeasures] = useState<MeasureConfig[]>([])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as { [key: string]: string }[]
        if (rawData.length) {
          const typedData = rawData.map(parseRow)
          setData(typedData)
          const keys = Object.keys(typedData[0])
          setAvailableFields(keys)
          setRows([])
          setColumns([])
          setMeasures([])
        }
      },
    })
  }

  function onDragStart(e: React.DragEvent, field: string, from: string) {
    e.dataTransfer.setData('field', field)
    e.dataTransfer.setData('from', from)
  }

  function onDrop(e: React.DragEvent, to: string) {
    e.preventDefault()
    const field = e.dataTransfer.getData('field')
    const from = e.dataTransfer.getData('from')

    if (!field || from === to) return

    const remove = (setFn: React.Dispatch<React.SetStateAction<any[]>>) =>
      setFn((f) => f.filter((x: any) => x !== field && x.field !== field))

    const add = (setFn: React.Dispatch<React.SetStateAction<any[]>>) => {
      if (to === 'measures') {
        setFn((f) => [...f, { field, agg: 'sum' }])
      } else {
        setFn((f) => [...f, field])
      }
    }

    if (from === 'available') setAvailableFields((f) => f.filter((x) => x !== field))
    else if (from === 'rows') remove(setRows)
    else if (from === 'columns') remove(setColumns)
    else if (from === 'measures') remove(setMeasures)

    if (to === 'rows') add(setRows)
    else if (to === 'columns') add(setColumns)
    else if (to === 'measures') add(setMeasures)
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault()
  }

  function removeFromGroup(field: string, from: string) {
    if (from === 'rows') setRows((f) => f.filter((x) => x !== field))
    else if (from === 'columns') setColumns((f) => f.filter((x) => x !== field))
    else if (from === 'measures') setMeasures((f) => f.filter((x) => x.field !== field))

    setAvailableFields((f) => [...f, field])
  }

  function updateAggregation(field: string, agg: MeasureConfig['agg']) {
    setMeasures((prev) => prev.map((m) => (m.field === field ? { ...m, agg } : m)))
  }

  const aggregate = (values: number[], type: string): number => {
    const valid = values.filter((v) => !isNaN(v))
    if (valid.length === 0) return 0
    if (type === 'sum') return valid.reduce((a, b) => a + b, 0)
    if (type === 'count') return values.length
    if (type === 'avg') return valid.reduce((a, b) => a + b, 0) / valid.length
    if (type === 'min') return Math.min(...valid)
    if (type === 'max') return Math.max(...valid)
    return 0
  }

  function groupData() {
    const pivot: Record<string, Record<string, PivotCell>> = {}
    const rowKeysSet = new Set<string>()
    const colKeysSet = new Set<string>()

    data.forEach((row) => {
      const rowKey = rows.map((r) => String(row[r])).join('|') || ''
      const colKey = columns.map((c) => String(row[c])).join('|') || ''
      rowKeysSet.add(rowKey)
      colKeysSet.add(colKey)

      if (!pivot[rowKey]) pivot[rowKey] = {}
      if (!pivot[rowKey][colKey]) pivot[rowKey][colKey] = {}

      measures.forEach(({ field }) => {
        const val = row[field]
        if (typeof val === 'number' && !isNaN(val)) {
          pivot[rowKey][colKey][field] = pivot[rowKey][colKey][field] || []
          pivot[rowKey][colKey][field].push(val)
        }
      })
    })

    const rowKeys = Array.from(rowKeysSet).sort()
    const colKeys = Array.from(colKeysSet).sort()

    return { pivot, rowKeys, colKeys }
  }

  const grouped = groupData()

  return (
    <div className="app-container">
      <h1>CSV Pivot Table</h1>
      <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />

      <div className="fields-container">
        {['available', 'rows', 'columns', 'measures'].map((group) => {
          const groupName =
            group === 'available' ? 'Available Fields' : group.charAt(0).toUpperCase() + group.slice(1)
          const groupFields =
            group === 'available'
              ? availableFields
              : group === 'rows'
              ? rows
              : group === 'columns'
              ? columns
              : measures.map((m) => m.field)

          return (
            <div
              key={group}
              className="drop-area"
              onDrop={(e) => onDrop(e, group)}
              onDragOver={allowDrop}
            >
              <h3>{groupName}</h3>
              {groupFields.length === 0 && <p>Drag fields here</p>}
              {groupFields.map((field) => (
                <div
                  key={field}
                  draggable
                  onDragStart={(e) => onDragStart(e, field, group)}
                  className="field-item"
                >
                  {field}{' '}
                  {group === 'measures' && (
                    <select
                      value={measures.find((m) => m.field === field)?.agg || 'sum'}
                      onChange={(e) => updateAggregation(field, e.target.value as MeasureConfig['agg'])}
                    >
                      <option value="sum">Sum</option>
                      <option value="avg">Avg</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  )}
                  {group !== 'available' && (
                    <button onClick={() => removeFromGroup(field, group)}>&times;</button>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="table-container">
        <h2>Pivot Table</h2>

        {!data.length && <p>Upload CSV to see table</p>}

        {data.length > 0 && rows.length === 0 && columns.length === 0 && measures.length === 0 && (
          <table>
            <thead>
              <tr>
                {Object.keys(data[0]).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {Object.keys(row).map((k) => (
                    <td key={k}>{row[k]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data.length > 0 && (rows.length > 0 || columns.length > 0 || measures.length > 0) && (
          <table>
           <thead>
  {Array.from({ length: columns.length }).map((_, level) => {
    const headerCells = []
    let prevLabel = null
    let span = 0

    // Track label parts across levels
    const colParts = grouped.colKeys.map((key) => key.split('|'))

    for (let i = 0; i < colParts.length; i++) {
      const parts = colParts[i]
      const label = parts[level] || ''
      const nextLabel = colParts[i + 1]?.[level] || ''
      const isLast = i === colParts.length - 1

      if (label === prevLabel) {
        span++
      } else {
        if (prevLabel !== null) {
          headerCells.push({
            label: prevLabel,
            span: span * measures.length,
          })
        }
        prevLabel = label
        span = 1
      }

      if (isLast) {
        headerCells.push({
          label,
          span: span * measures.length,
        })
      }
    }

    return (
      <tr key={`level-${level}`}>
        {level === 0 &&
          rows.map((r) => (
            <th key={r} rowSpan={columns.length + 1}>
              {r}
            </th>
          ))}

        {headerCells.map(({ label, span }, i) => (
          <th key={`h-${level}-${i}`} colSpan={span}>
            {label}
          </th>
        ))}

        {level === 0 && (
          <th rowSpan={columns.length + 1}>Grand Total</th>
        )}
      </tr>
    )
  })}

  {/* Final header row (bottom row): measure names per column */}
  <tr>
    {grouped.colKeys.map((colKey) =>
      measures.map(({ field, agg }) => (
        <th key={`${colKey}-${field}`}>
          {field} ({agg.toUpperCase()})
        </th>
      ))
    )}
    
  </tr>
</thead>

            <tbody>
              {grouped.rowKeys.map((rowKey) => (
                <tr key={rowKey}>
                  {rows.map((r, idx) => (
                    <td key={r}>{rowKey.split("|")[idx]}</td>
                  ))}
                  {grouped.colKeys.map((colKey) =>
                    measures.map(({ field, agg }) => {
                      const values = grouped.pivot[rowKey]?.[colKey]?.[field] || []
                      const val = aggregate(values, agg)
                      return (
                        <td key={`${colKey}-${field}`}>
                          {isNaN(val) ? " " : val === 0 ? "" : val.toFixed(2)}
                        </td>
                      )
                    })
                  )}
                  <td>
                    {measures
                      .map(({ field, agg }) => {
                        let totalValues: number[] = []
                        grouped.colKeys.forEach((colKey) => {
                          const vals = grouped.pivot[rowKey]?.[colKey]?.[field] || []
                          totalValues = totalValues.concat(vals)
                        })
                        const val = aggregate(totalValues, agg)
                        return isNaN(val) ? " " : val === 0 ? "" : val.toFixed(2)
                      })
                      .join(", ")}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={rows.length || 1}>Total</td>
                {grouped.colKeys.map((colKey) =>
                  measures.map(({ field, agg }) => {
                    let colValues: number[] = []
                    grouped.rowKeys.forEach((rowKey) => {
                      const vals = grouped.pivot[rowKey]?.[colKey]?.[field] || []
                      colValues = colValues.concat(vals)
                    })
                    const val = aggregate(colValues, agg)
                    return (
                      <td key={`total-${colKey}-${field}`}>
                        {isNaN(val) ? " " : val === 0 ? "" : val.toFixed(2)}
                      </td>
                    )
                  })
                )}
                <td>
                  {measures
                    .map(({ field, agg }) => {
                      let allValues: number[] = []
                      grouped.rowKeys.forEach((rowKey) => {
                        grouped.colKeys.forEach((colKey) => {
                          const vals = grouped.pivot[rowKey]?.[colKey]?.[field] || []
                          allValues = allValues.concat(vals)
                        })
                      })
                      const val = aggregate(allValues, agg)
                      return isNaN(val) ? " " : val === 0 ? "" : val.toFixed(2)
                    })
                    .join(", ")}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

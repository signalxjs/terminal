export { Table } from './Table';
export { QRCode } from './QRCode';

// Data-dense dashboard components. The layout, scaling and sorting maths they
// wrap is pure and lives in @sigx/terminal-zero, so an app can use it headlessly
// (e.g. `printStatic(sparkline(...))`) without mounting anything.
export { DataTable, type SortDir, type SortState } from './DataTable';
export { Sparkline } from './Sparkline';
export { Meter } from './Meter';
export { Trend } from './Trend';
export { BarChart, type BarChartItem } from './BarChart';
export { DetailList, type DetailRow } from './DetailList';
export { StatusGrid } from './StatusGrid';
export { colorAt, type Threshold } from './thresholds';

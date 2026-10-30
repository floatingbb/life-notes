export const JOURNAL_ZONE='Asia/Shanghai';
const monthFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:JOURNAL_ZONE,year:'numeric',month:'2-digit'}),dateFormatter=new Intl.DateTimeFormat('zh-CN',{timeZone:JOURNAL_ZONE,year:'numeric',month:'long',day:'numeric'});
export function journalMonth(value){const parts=monthFormatter.formatToParts(new Date(value));return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value}
export function journalDate(value){return dateFormatter.format(new Date(value))}
export function journalMonthBounds(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Object.assign(Error('月份不正确'),{status:400});const [y,m]=month.split('-').map(Number);return [new Date(Date.UTC(y,m-1,1)-28800000).toISOString(),new Date(Date.UTC(y,m,1)-28800000).toISOString()]}

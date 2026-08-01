const numberFormatter = new Intl.NumberFormat('ar-EG');
const percentFormatter = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat('ar-EG', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('ar-EG', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatNumber = (value: number): string => numberFormatter.format(value);
export const formatPercent = (value: number): string => `${percentFormatter.format(value)}%`;
export const formatDate = (value: string | Date): string => dateFormatter.format(new Date(value));
export const formatDateTime = (value: string | Date): string => dateTimeFormatter.format(new Date(value));

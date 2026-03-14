/**
 * Format a date string to "DD of Month (MM), YYYY" format
 * Example: "02 of January (01), 2026"
 */
export function formatEventDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'Date TBA';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) return 'Date TBA';
    
    const day = String(date.getDate()).padStart(2, '0');
    const monthIndex = date.getMonth();
    const monthNumber = String(monthIndex + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[monthIndex];
    
    return `${day} of ${monthName} (${monthNumber}), ${year}`;
  } catch {
    return 'Date TBA';
  }
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string | Date | undefined | null): boolean {
  if (!dateString) return false;
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const today = new Date();
    
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  } catch {
    return false;
  }
}

/**
 * Check if a date is in the future (including today)
 */
export function isFutureOrToday(dateString: string | Date | undefined | null): boolean {
  if (!dateString) return false; // Exclude events without dates — they only show on MAP page
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    // Set to start of today for comparison
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return date >= startOfToday;
  } catch {
    return true;
  }
}

/**
 * Format a short date for compact displays
 * Example: "Feb 04"
 */
export function formatShortDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'TBA';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'TBA';
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${monthNames[date.getMonth()]} ${day}`;
  } catch {
    return 'TBA';
  }
}

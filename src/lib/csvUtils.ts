import Papa from 'papaparse';

// HTML 태그 제거 및 보안 처리
const sanitize = (text: string): string => {
    if (typeof text !== 'string') return '';
    // CSV formula injection defense: prefix dangerous characters
    let result = text;
    if (/^[=+\-@\t\r]/.test(result)) {
        result = "'" + result;
    }
    return result
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .trim()
        .slice(0, 500); // 최대 길이 제한 (500자)
};

// CSV 내보내기
export const exportToCSV = <T>(data: T[], filename: string, headers: string[]) => {
    const csv = Papa.unparse({
        fields: headers,
        data: data,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// CSV 불러오기 결과 타입
interface ImportResult<T> {
    success: T[];
    errors: string[];
}

// CSV 불러오기
export const importFromCSV = <T>(
    file: File,
    validate: (row: any) => { valid: boolean; error?: string; data?: T }
): Promise<ImportResult<T>> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: Papa.ParseResult<any>) => {
                const success: T[] = [];
                const errors: string[] = [];

                results.data.forEach((row: any, index: number) => {
                    // XSS 방지: 문자열 값 sanitization
                    const sanitizedRow: any = {};
                    Object.keys(row).forEach((key) => {
                        sanitizedRow[key] = sanitize(row[key]);
                    });

                    const validation = validate(sanitizedRow);
                    if (validation.valid && validation.data) {
                        success.push(validation.data);
                    } else {
                        errors.push(`Row ${index + 2}: ${validation.error || 'Invalid data'}`);
                    }
                });

                resolve({ success, errors });
            },
            error: (error: Error) => {
                reject(error);
            },
        });
    });
};

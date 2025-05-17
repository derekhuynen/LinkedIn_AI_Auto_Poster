import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export class MdService {
	static readMarkdownFile(filePath: string): string {
		const resolvedPath = join(__dirname, filePath);

		if (!existsSync(resolvedPath)) {
			throw new Error(`Markdown file not found at path: ${resolvedPath}`);
		}

		try {
			return readFileSync(resolvedPath, 'utf-8');
		} catch (error: any) {
			throw new Error(
				`Error reading markdown file at path: ${resolvedPath}. Details: ${error.message}`
			);
		}
	}
}

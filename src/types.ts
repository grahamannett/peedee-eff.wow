export interface QueuedFile {
	id: string;
	path: string;
	name: string;
	size: number;
	status: "queued" | "converting" | "complete" | "error";
	progress: number;
	progressMessage: string;
	outputs?: {
		markdown?: string;
		epub?: string;
		images?: string[];
	};
	error?: string;
}

export interface ConversionOptions {
	force_ocr: boolean;
	page_range: string;
	language: string;
	extract_images: boolean;
	output_formats: string[];
	engine: string;
}

export interface SidecarEvent {
	type: string;
	id?: string;
	percent?: number;
	message?: string;
	outputs?: Record<string, unknown>;
	engine?: string;
	downloaded?: boolean;
	size_bytes?: number;
}

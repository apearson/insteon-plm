export interface DeviceDB{
	version: string;
	categories: Category[];
	devices: Device[];
	gateways: Gateways[];
}

export interface Category {
	[key: string]: string;
}

export interface Device {
	name: string;
	description: string;
	cat: string;
	subcat: string;
	firmwares: string[];
	flags?: string;
}

export interface Gateways {
	name: string;
	description: string;
	cat: string;
	subcat: string;
	firmwares: string[];
	flags?: string;
}
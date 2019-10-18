interface DeviceDB{
  version: string;
  categories: Category[];
  devices: Device[];
  gateways: Gateways[];
}

interface Category {
  [key: string]: string;
}

interface Device {
  name: string;
  description: string;
  cat: string;
  subcat: string;
  firmwares: string[];
  flags?: string;
}

interface Gateways {
  name: string;
  description: string;
  cat: string;
  subcat: string;
  firmwares: string[];
  flags?: string;
}
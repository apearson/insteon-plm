/* Libraries */
import InsteonDevice, { DeviceLinkRecord } from "./devices/InsteonDevice";
import { AllLinkRecordType, Byte } from "insteon-packet-parser";
import { ModemLink } from "./PowerLincModem";
import deviceDB from './deviceDB.json';

/* Devices */
import KeypadDimmer from "./devices/DimmableLightingDevice/KeypadDimmer";
import DimmableLightingDevice from "./devices/DimmableLightingDevice/DimmableLightingDevice";
import SwitchedLightingDevice from "./devices/SwitchedLightingDevice/SwitchedLightingDevice";
import SensorActuatorDevice from "./devices/SensorActuatorDevice/SensorActuatorDevice";
import IOLinc from "./devices/SensorActuatorDevice/IOLinc";
import MotionSensor from "./devices/SecurityDevice/MotionSensor";
import OpenCloseSensor from "./devices/SecurityDevice/OpenCloseSensor";
import LeakSensor from "./devices/SecurityDevice/LeakSensor";
import SecurityDevice from "./devices/SecurityDevice/SecurityDevice";

interface ClassMap {
	[index: string]: typeof InsteonDevice
}

/* General Functions */

export function toAddressString(address: Byte[]){
  return address.map(num => num.toString(16).toUpperCase().padStart(2, '0')).join('.');
}

export function toAddressArray(address: String){
	return address.split(".").map(el => parseInt(el,16)) as Byte[];
}

export function validateAddress(address: String){
	let adr = address.split('.');
	if(adr.length !== 3) return false;

	for(var i = 0; i < 3; i++){
		let val = parseInt(adr[i],16);
		if(isNaN(val) || val < 0 || val > 255) return false;
	}

	return true;
}

export function nextLinkAddress(address: Byte[]) {
	var next = ((address[0] << 8 | address[1]) - 8);
	var result = [next >> 8, next & 255] as Byte[];

	if (result[0] < 0) {
		throw Error("Out of address space");
	}

	return result;
}

export function calculateHighWaterAddress(links: DeviceLinkRecord[]){
	let highWater = [] as Byte[];

	for(var i = 0; i < links.length; i++){
		highWater = links[i].address;

		for(var j = i; j < links.length; j++){
			if(toAddressString(links[j].device) !== '00.00.00'){
				highWater = [];
			}
		}

		if(highWater.length) break;
	}

	if(highWater.length === 0){
		highWater = nextLinkAddress(links[links.length-1].address);
	}

	return highWater;
}

export function toHex(n: number){
	return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function clamp(val: number, min: number, max: number) {
	return val > max ? max : val < min ? min : val;
}

export async function getDeviceClass(cat: number, subcat: number) {

	const deviceInfo = deviceDB.devices.find(d =>
		d.cat === toHex(cat) && d.subcat === toHex(subcat)
	);

	// If no device found then return null
	if(!deviceInfo)
		return null;

	return getDeviceClassFromClassName(deviceInfo.class);
}

export function getDeviceClassFromClassName(className: string) {
	const classMap: ClassMap = {
		InsteonDevice,
		DimmableLightingDevice,
		KeypadDimmer,
		SwitchedLightingDevice,
		IOLinc,
		SensorActuatorDevice,
		MotionSensor,
		OpenCloseSensor,
		LeakSensor,
		SecurityDevice
	};

	return classMap[className];
}

export function deviceDbToTable(links: DeviceLinkRecord[]){

	// Creating table header
	let table = '| Address | Active | Device   | Type       | Group | Level | Rate | ~ |\n' +
	            '|---------|--------|----------|------------|-------|-------|------|---|';

	// Looping over links
	for (let link of links){

		//Grabbing data from links
		let address = `0x${link.address.map(a => toHex(a).substring(2).toUpperCase()).join('')}`;
		let active = link.Type.active ? '✓' : '×';
		let type = AllLinkRecordType[link.Type.control];
		let group = link.group.toString();
		let device = link.device.map(toHex).map(a => a.substring(2)).join('.').toUpperCase();
		let level = link.onLevel.toString();
		let rate = link.rampRate.toString();
		let highWater = link.Type.highWater;

		// Creating row
		let row = `| ${address.padStart(7)} | ${active.padEnd(6)} | ${device.padEnd(8)} | ${type.padEnd(10)} | ${group.padStart(5)} | ${level.padStart(5)} | ${rate.padStart(4)} | ${highWater? '~' : '-'} |`;

		// Adding row to table
		table += `\n${row}`
	}

	// Returning completed table
	return table;
}

export function modemDbToTable(links: ModemLink[]){

	// Creating table header
	let table = '| Group | Device   | Type       | Link Data      |\n' +
	            '|-------|----------|------------|----------------|';

	// Looping over links
	for (let link of links){

		let group = link.group.toString();
		let device = toAddressString(link.device);
		let type = AllLinkRecordType[link.type];
		let linkData = link.linkData.map(toHex).join(',');

		// Creating row
		let row = `| ${group.padStart(5)} | ${device.padEnd(8)} | ${type.padEnd(10)} | ${linkData.padEnd(14)} |`;

		// Adding row to table
		table += `\n${row}`
	}

	// Returning completed table
	return table;

}
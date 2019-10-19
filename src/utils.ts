/* Libraries */
import { isArray } from "util";
import { DeviceLinkRecord } from "./devices/InsteonDevice";
import { AllLinkRecordType, Packet, Byte } from "insteon-packet-parser";
import { ModemLink } from "./PowerLincModem";

/* General Functions */

export function toAddressString(address: Byte[]){
  return address.map(num => num.toString(16).toUpperCase().padStart(2, '0')).join('.');
}

export function toAddressArray(address: String){
	return address.split(".").map(el => parseInt(el,16));
}

export function toHex(n: number){
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function deviceDbToTable(links: DeviceLinkRecord[]){
  
  // Creating table header
  let table = '| Address | Device   | Type       | Group | Level | Rate | ~ |\n' +
              '|---------|----------|------------|-------|-------|------|---|';
              // '| 0x0fe7 | Controller | 254   | 31.15.C9 | 255   | 255  |'

  // Looping over links
  for (let link of links){

    //Grabbing data from links
    let address = `0x${link.address.map(a => toHex(a).substring(2).toUpperCase()).join('')}`;
    let type = AllLinkRecordType[link.Type.control];
    let group = link.group.toString();
    let device = link.device.map(toHex).map(a => a.substring(2)).join('.').toUpperCase();
    let level = link.onLevel.toString();
    let rate = link.rampRate.toString();
    let highWater = link.Type.highWater;

    // Creating row
    let row = `| ${address.padStart(7)} | ${device.padEnd(8)} | ${type.padEnd(10)} | ${group.padStart(5)} | ${level.padStart(5)} | ${rate.padStart(4)} | ${highWater? '~' : '-'} |`;

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

export const wait = (t: number) => new Promise(r => setTimeout(r, t));
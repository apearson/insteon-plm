/* Libraries */
import { isArray } from "util";
import { DeviceLinkRecord } from "./devices/InsteonDevice";
import { AllLinkRecordType, Packets } from "./main";

/* General Functions */
export function toHex(numbers: number){
  const nums = isArray(numbers) ? numbers : [numbers];

  return `0x${Buffer.from(nums).toString('hex')}`;
}

export function deviceDbToTable(links: DeviceLinkRecord[]){
  
  // Creating table header
  let table = '| Address | Device   | Type       | Group | Level | Rate |\n' +
              '|---------|----------|------------|-------|-------|------|';
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

    // Creating row
    let row = `| ${address.padStart(7)} | ${device.padEnd(8)} | ${type.padEnd(10)} | ${group.padStart(5)} | ${level.padStart(5)} | ${rate.padStart(4)} |`;

    // Adding row to table
    table += `\n${row}`
  }

  // Returning completed table
  return table;
}

export function modemDbToTable(links: Packets.AllLinkRecordResponse[][]){
  
  // Creating table header
  let table = '| Group | Device   | Type       | Link Data      |\n' +
              '|-------|----------|------------|----------------|';

  // Looping over links
  for (let groupRecords of links){
    for (let record of groupRecords){

      let group = record.allLinkGroup.toString();
      let device = record.from.map(toHex).map(a => a.substring(2)).join('.').toUpperCase();
      let type = AllLinkRecordType[record.Flags.recordType];
      let linkData = record.linkData.map(toHex).join(',');

      // Creating row
      let row = `| ${group.padStart(5)} | ${device.padEnd(8)} | ${type.padEnd(10)} | ${linkData.padEnd(14)} |`;

      // Adding row to table
      table += `\n${row}`
    }
  }

  // Returning completed table
  return table;

}
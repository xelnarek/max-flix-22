const PNG_SIGNATURE=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
export const POLYHAVEN_TEXTURE_ASSETS=Object.freeze([
 {id:'concrete_floor_worn_001',maps:['diff','nor_gl','arm'],role:'warehouse-concrete-floor'},
 {id:'factory_wall',maps:['diff','nor_gl','arm'],role:'industrial-corrugated-wall'},
 {id:'metal_plate_02',maps:['diff','nor_gl','arm'],role:'worn-steel-barriers-and-trims'},
]);
export function makePolyHavenMapUrl(assetId,map,resolution='2k'){
 return 'https://dl.polyhaven.org/file/ph-assets/Textures/png/'+resolution+'/'+assetId+'/'+assetId+'_'+map+'_'+resolution+'.png';
}
export function isPng(bytes){return Buffer.isBuffer(bytes)&&bytes.length>8&&bytes.subarray(0,8).equals(PNG_SIGNATURE);}

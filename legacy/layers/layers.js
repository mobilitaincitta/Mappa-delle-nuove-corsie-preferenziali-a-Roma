var wms_layers = [];


        var lyr_ESRIGraylight_0 = new ol.layer.Tile({
            'title': 'ESRI Gray (light)',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
            })
        });
var format_Corsiepreferenzialiesistenti_1 = new ol.format.GeoJSON();
var features_Corsiepreferenzialiesistenti_1 = format_Corsiepreferenzialiesistenti_1.readFeatures(json_Corsiepreferenzialiesistenti_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Corsiepreferenzialiesistenti_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Corsiepreferenzialiesistenti_1.addFeatures(features_Corsiepreferenzialiesistenti_1);
var lyr_Corsiepreferenzialiesistenti_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Corsiepreferenzialiesistenti_1, 
                style: style_Corsiepreferenzialiesistenti_1,
                popuplayertitle: 'Corsie preferenziali esistenti',
                interactive: true,
    title: 'Corsie preferenziali esistenti<br />\
    <img src="styles/legend/Corsiepreferenzialiesistenti_1_0.png" /> PROMISCUO<br />\
    <img src="styles/legend/Corsiepreferenzialiesistenti_1_1.png" /> TRAM<br />' });
var format_Nuovecorsiepreferenzialiperpriorit_2 = new ol.format.GeoJSON();
var features_Nuovecorsiepreferenzialiperpriorit_2 = format_Nuovecorsiepreferenzialiperpriorit_2.readFeatures(json_Nuovecorsiepreferenzialiperpriorit_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Nuovecorsiepreferenzialiperpriorit_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Nuovecorsiepreferenzialiperpriorit_2.addFeatures(features_Nuovecorsiepreferenzialiperpriorit_2);
var lyr_Nuovecorsiepreferenzialiperpriorit_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Nuovecorsiepreferenzialiperpriorit_2, 
                style: style_Nuovecorsiepreferenzialiperpriorit_2,
                popuplayertitle: 'Nuove corsie preferenziali per priorità',
                interactive: true,
    title: 'Nuove corsie preferenziali per priorità<br />\
    <img src="styles/legend/Nuovecorsiepreferenzialiperpriorit_2_0.png" /> 1<br />\
    <img src="styles/legend/Nuovecorsiepreferenzialiperpriorit_2_1.png" /> 2<br />\
    <img src="styles/legend/Nuovecorsiepreferenzialiperpriorit_2_2.png" /> 3<br />' });

lyr_ESRIGraylight_0.setVisible(true);lyr_Corsiepreferenzialiesistenti_1.setVisible(true);lyr_Nuovecorsiepreferenzialiperpriorit_2.setVisible(true);
var layersList = [lyr_ESRIGraylight_0,lyr_Corsiepreferenzialiesistenti_1,lyr_Nuovecorsiepreferenzialiperpriorit_2];
lyr_Corsiepreferenzialiesistenti_1.set('fieldAliases', {'FID': 'FID', 'STRADA': 'STRADA', 'DA': 'DA', 'A': 'A', 'LUNGHEZZA': 'LUNGHEZZA', 'ANNOTAZION': 'ANNOTAZION', 'TIPO_USO': 'Tipologia di utilizzo', 'DELIMITAZI': 'DELIMITAZI', 'ST_QUALITA': 'ST_QUALITA', 'Monit': 'Monit', 'Da_Monit': 'Da_Monit', 'Shape__Len': 'Shape__Len', 'Attivazion': 'Attivazion', });
lyr_Nuovecorsiepreferenzialiperpriorit_2.set('fieldAliases', {'fid': 'fid', 'shape_id': 'shape_id', 'begin': 'begin', 'end': 'end', 'trip_count': 'trip_count', 'dist_m': 'dist_m', 'scenario': 'Priorità di intervento', 'nuovo': 'nuovo', 'strada': 'strada', 'Direction': 'Direction', 'linee': 'linee', 'Ty_CP': 'Tipologia di intervento possibile', 'trip_n': 'trip_n', });
lyr_Corsiepreferenzialiesistenti_1.set('fieldImages', {'FID': 'Hidden', 'STRADA': 'TextEdit', 'DA': 'Hidden', 'A': 'Hidden', 'LUNGHEZZA': 'Hidden', 'ANNOTAZION': 'Hidden', 'TIPO_USO': 'TextEdit', 'DELIMITAZI': 'Hidden', 'ST_QUALITA': 'Hidden', 'Monit': 'Hidden', 'Da_Monit': 'Hidden', 'Shape__Len': 'Hidden', 'Attivazion': 'Hidden', });
lyr_Nuovecorsiepreferenzialiperpriorit_2.set('fieldImages', {'fid': 'Hidden', 'shape_id': 'Hidden', 'begin': 'Hidden', 'end': 'Hidden', 'trip_count': 'Hidden', 'dist_m': 'Hidden', 'scenario': 'TextEdit', 'nuovo': 'Hidden', 'strada': 'TextEdit', 'Direction': 'Hidden', 'linee': 'Hidden', 'Ty_CP': 'TextEdit', 'trip_n': 'Hidden', });
lyr_Corsiepreferenzialiesistenti_1.set('fieldLabels', {'STRADA': 'hidden field', 'TIPO_USO': 'no label', });
lyr_Nuovecorsiepreferenzialiperpriorit_2.set('fieldLabels', {'scenario': 'no label', 'strada': 'hidden field', 'Ty_CP': 'hidden field', });
lyr_Nuovecorsiepreferenzialiperpriorit_2.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChartEditor } from '../src/components/ChartEditor';
import { editorFixture } from './fixtures/editorCharts';
import '../src/index.css';
import { validateChartImport, readOffsetSeconds } from '../src/lib/editorTiming';
import { AudioService } from '../src/services/audioService';

function Harness() {
  if (new URLSearchParams(location.search).has('manual')) localStorage.setItem('BEATPULSE_EDITOR_SAVE_MODE','manual');
  const [buffers,setBuffers] = useState<Record<string, AudioBuffer>>({});
  const [songs, setSongs] = useState(() => {
    const saved = localStorage.getItem('AUDIT_FIXTURE');
    const params = new URLSearchParams(location.search);
    return [saved ? JSON.parse(saved) : {...editorFixture(Number(params.get('count') || 23),params.has('legacy')?250:0), isPreset: params.has('preset')}];
  });
  const store = (update: (song: typeof songs[number]) => typeof songs[number]) => setSongs(previous => previous.map(song => {
    const result = update(song); localStorage.setItem('AUDIT_FIXTURE',JSON.stringify(result)); return result;
  }));
  return <ChartEditor songs={songs} activeDifficulty="Audit" audioBuffers={buffers} onTestPlay={(_s, chart, start) => { (window as any).testedChart = chart; (window as any).testedStart = start; }}
    onRelinkSongAudio={async (id,file)=>{const decoded=await AudioService.decodeAudioBlob(file);setBuffers(previous=>({...previous,[id]:decoded}));store(song=>({...song,duration:decoded.duration}));}}
    onAddDifficulty={(_id,name)=>store(song=>({...song,charts:{...song.charts,[name]:{...song.charts.Audit,difficulty:name,notes:[]}}}))}
    onRenameDifficulty={(_id,old,name)=>store(song=>({...song,charts:Object.fromEntries(Object.entries(song.charts).map(([key,c]:[string,any])=>[key===old?name:key,key===old?{...c,difficulty:name}:c]))}))}
    onReorderDifficulties={(_id,order)=>store(song=>({...song,charts:Object.fromEntries(order.map(key=>[key,song.charts[key]]))}))}
    onDeleteDifficulty={(_id,name)=>store(song=>({...song,charts:Object.fromEntries(Object.entries(song.charts).filter(([key])=>key!==name))}))}
    onDuplicateDifficulty={(_id,source,name)=>store(song=>({...song,charts:{...song.charts,[name]:{...song.charts[source],difficulty:name}}}))}
    onImportChartJson={async (_id,text)=>{const data=JSON.parse(text);const chart=data.chart||data;validateChartImport(chart);store(song=>({...song,charts:{...song.charts,[chart.difficulty||'Audit']:{...song.charts.Audit,...chart,offset:readOffsetSeconds(chart),offsetUnit:'seconds'}}}));}}
    onSaveChart={(id, difficulty, chart) => setSongs(previous => previous.map(song => {
      if (song.id !== id) return song;
      const updated = { ...song, charts: { ...song.charts, [difficulty]: chart } };
      localStorage.setItem('AUDIT_FIXTURE', JSON.stringify(updated)); return updated;
    }))} />;
}
createRoot(document.getElementById('root')!).render(<Harness />);

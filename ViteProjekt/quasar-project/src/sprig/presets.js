export const BMX_PRESETS = [
  {
    id: 'bmx_hfd01a',
    name: 'BMX: HDF01a (ARD/ZDF)',
    tags: ['mxf','hdf01a','rdd9','afd','16:9'],
    body: `--fixed-part
--part
240
--body-part
--check-end-tolerance
1
--ard-zdf-hdf
-t
rdd9
--afd
8
-a
16:9
{{ $noas := int64 (.GetVariable "noas") }}
{{ if ge $noas 8 }}
--track-map
mono
{{ else }}
--track-map
m0-{{ sub $noas 1 }},s{{ sub 8 $noas }}
{{ end }}
-o
"[[WatchFolder]]/output/[[FileNameNoSuf]]_HFD01a.mxf"`
  }
]

export const FFMPEG_PRESETS = [
  {
    id: 'ffmpeg_sd576i_mpeg2',
    name: 'FFmpeg: SD 576i MPEG-2 (bwdif + interlace)',
    tags: ['sd','mpeg2','interlaced'],
    body: `-vf
{{ $scanntype :=  .GetMIValue "video" "ScanType" 0}}
{{ if eq $scanntype "Interlaced"  }}bwdif=1:-1:0,scale=720:576,interlace=tff:2{{ else }}scale=720:576,interlace=tff:2{{ end }}
-c:v mpeg2video -r 25 -pix_fmt yuv422p -aspect 16:9
-b:v 50000k -minrate 50000k -maxrate 50000k -bufsize 2000000
-c:a pcm_s24le -ar 48000 -ac 8
-f mxf_d10`
  }
]

export const SPRIG_PRESETS = [
  ...BMX_PRESETS.map(p => ({ ...p, engine: 'bmx' })),
  ...FFMPEG_PRESETS.map(p => ({ ...p, engine: 'ffmpeg' }))
]

// 封装-请求接口
const QxRequest = (method, url, params)=> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {   // 成功
          if(xhr.responseText.startsWith('<')) {  // xml
            let responseText = xml2json(xhr.responseText)
            resolve(responseText);
          }else {  // json
            resolve(JSON.parse(xhr.responseText));
          }
        } else {
          let query = {
            code: -2,
            msg: '连接异常！'
          }
          resolve(query);  // 网络错误或者请求终止
        }
      }
    };

    // get
    if (method === "get" || method === "GET") {
      if (typeof params === "object") {
        // params拆解成字符串
        params = Object.keys(params)
          .map(function (key) {
            return (
              encodeURIComponent(key) + "=" + encodeURIComponent(params[key])
            );
          })
          .join("&");
      }
      url = params ? url + "?" + params : url;
      xhr.open(method, url, true);
      xhr.timeout = 8000; // 超时时间，单位是毫秒
      xhr.send();
    }

    //post
    if (method === "post" || method === "POST") {
      xhr.open(method, url, true);
      xhr.setRequestHeader("Accept", "*/*");
      xhr.timeout = 8000; // 超时时间，单位是毫秒
      xhr.send(JSON.stringify(params));
    }
  });
}

const xml2json = (val)=>{
  let x2js = new X2JS();
  return x2js.xml_str2json(val)
}
 
const base_url = "http://127.0.0.1:9585/icvs2/"; // 本地插件

const webcu2plugin = {
  // 登录
  login: async (params, callback) => {
    let reslut = {
      code: -1,
    };
    let res = await QxRequest("post", `${base_url}login`, params);
    if (res.msg === "OK") {
      reslut.code = 0;
      reslut.msg = res.msg;
      reslut.token = res.token;
      // 连接ws
      let url = websocket_url + "?token=" + res.token;
      let ws = new WebSocket(url);
      ws.onmessage = (evt) => {
        if (typeof evt === "object" && evt.data && callback) {
          let msg = xml2json(evt.data).M;
          // callback(msg)
          // 第一类事件(插件处理的)
          if (msg._Type === "PlayEvent") {  // 视频播放状态
            let params = {
              type: 'playEvent',
              data: {
                status: msg._Status,
                palyId: msg._PlayID,
              }
            }
            callback(params)
          }
          if(msg._Type === "DownlaodEvent") {  // 视频下载状态
            let params = {
              type: 'downlaodEvent',
              data: {
                status: msg._Status,
                palyId: msg._DownloadID,
              }
            }
            callback(params)
          }
          // 第二类事件(ICVS平台返回的)
          let event = msg.E || null;
          if (event) {
            if (event._ID === "E_CU_Online") {  // 用户上线
              let params = {
                type: 'userOnline',
                data: {
                  UserID: event.Desc._UserID,
                  EPID: event.Desc._EPID
                }
              }
              callback(params)
            } else if (event._ID === "E_CU_Offline") {  // 用户下线
              let params = {
                type: 'userOffline',
                data: {
                  UserID: event.Desc._UserID,
                  EPID: event.Desc._EPID
                }
              }
              callback(params)
            } else if (event._ID === "E_PU_Online") {   // 设备上线
              let params = {
                type: 'deviceOnline',
                data: {
                  Name: event.Src._Name,
                  Type: event.Src._Type,
                  Idx: event.Src._Idx,
                  Desc: event.Src._Desc,
                }
              }
              callback(params)
            } else if (event._ID === "E_PU_Offline") {   // 设备下线
              let params = {
                type: 'deviceOffline',
                data: {
                  Name: event.Src._Name,
                  Type: event.Src._Type,
                  Idx: event.Src._Idx,
                  Desc: event.Src._Desc,
                }
              }
              callback(params)
            }else if (event._ID === "E_GS_GPSDataUpdate") {   // gps信息更新
              // let params = {
              //   type: 'gpsDataUpdate',
              //   data: {
              //   }
              // }
              // callback(params)
            }
             else if (event._ID === "PlayNtf") {
              console.log("playNtf");
              console.log(event);
            }
          }
        }
      };
      ws.onclose = ()=> {
        let params = {
          type: 'Error',
        }
        callback(params)
      };
      ws.onerror = function () {
        let params = {
          type: 'Error',
        }
        callback(params)
      };
    }else {
      reslut = res;
    }
    return reslut;
  },

  // 获取设备列表
  getDeviceList: (params) => {
    return QxRequest('get',`${base_url}CAS/C_CAS_QueryPUIDSets`, params);
  },

  // 获取单个设备列表子资源
  getDeviceByPuid: (params) => {
    return QxRequest('get',`${base_url}C_CAS_QueryPUIDRes`, params);
  },

  // 获取播放ID
  getPlayVideoId: (params) => {
    return QxRequest('get',`${base_url}video/startVideo2`, params);
  },

  // 云台控制(13个指令)
  ptzControl: (params) => {
    let puid = params.puid || "";
    let idx = params.idx || 0;
    let control =params.control || "";
    let speed = params.speed || '';
    let xml = "";
    let token =  params.token
    if (!puid || !control) {
      return
    }

    // 云台上下左右
    if (control === "left" || control === "up" || control === "right" || control === "down" || control === "stop") {
      let params = {
        puid,
        motion: control,
        idx,
        token,
        speed
      }
      return QxRequest('post',`${base_url}PTZ/C_PTZ_Turn`, params);
    }
    //放大图像
    if (control === "zoomin") {
      let params = { speed,puid,idx,token }
      return QxRequest('post',`${base_url}PTZ/C_PTZ_ZoomInPicture`, params);
    }
    // 缩小图像
    if (control === "zoomout") {
      let params = { speed,puid,idx,token }
      return QxRequest('post',`${base_url}PTZ/C_PTZ_ZoomOutPicture`, params);
    }
    // 停止缩放
    if (control === "stopzoom") {
      let params = { speed,puid,idx,token }
      return QxRequest('post',`${base_url}PTZ/C_PTZ_StopPictureZoom`, params);
    }
    // 推远焦点
    if (control === "focusfar") {
      let params = { speed,puid,idx,token }
      return QxRequest('post',`${base_url}PTZ/C_PTZ_MakeFocusFar`, params);
    }
    // 拉近焦点
    if (control === "focusnear") {
      let params = { speed,puid,idx,token }
      return QxRequest('post',`${base_url}PTZ/C_PTZ_MakeFocusNear`, params);
    }
    // 停止调焦
    if (control === "stopfocus") {
      let params = { speed,puid,idx,token }
      return QxRequest('post',`${base_url}PTZ/C_PTZ_StopFocusMove`, params);
    }
    if (control === "augment") {
      // 增大光圈
      xml = '<?xml version="1.0" encoding="UTF-8"?><M Type="ComReq"><C Type="G" Prio="1" EPID="system" Lang="zh_CN"> <Res Type="IV" Idx="'+idx+'" OptID="C_PTZ_AugmentAperture" Stream="0"><Param></Param></Res></C></M>';
      let url = `${base_url}RawRequest?dstType=201&dstID=${puid}&token=${token}`
      let params= { xml }
      return QxRequest('post',url, params);
    }
    if (control === "minish") { 
      // 缩小光圈
      xml = '<?xml version="1.0" encoding="UTF-8"?><M Type="ComReq"><C Type="G" Prio="1" EPID="system" Lang="zh_CN"><Res Type="IV" Idx="'+idx+'" OptID="C_PTZ_MinishAperture" Stream="0"><Param></Param></Res></C></M>';
      let url = `${base_url}RawRequest?dstType=201&dstID=${puid}&token=${token}`
      let params= { xml }
      return QxRequest('post', url , params);
    } 
    if (control === "stopaperture") { 
      // 停止光圈
      xml = '<?xml version="1.0" encoding="UTF-8"?><M Type="ComReq"><C Type="G" Prio="1" EPID="system" Lang="zh_CN"><Res Type="IV" Idx="'+idx+'" OptID="C_PTZ_StopApertureZoom" Stream="0"><Param></Param></Res></C></M>';
      let url = `${base_url}RawRequest?dstType=201&dstID=${puid}&token=${token}`
      let params= { xml }
      return QxRequest('post', url , params);
    }
  },

  // 获取预置位列表
  getPresetPosList: async (query)=> {
    let result = {
      code: -1,
      rows:[],
    }
    let idx = query.idx || '0'
    let puid = query.puid || ''
    let token = query.token || ''
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <M Type="ComReq">
      <C Type="G" Prio="1" EPID="system" Lang="zh_CN">
        <Res Type="PTZ" Idx="${idx}" OptID="F_PTZ_PresetPositionSets" Stream="0"><Param></Param></Res>
      </C>
    </M>`
    let url = `${base_url}RawRequest?dstType=201&dstID=${puid}&token=${token}`
    let params= { xml }
    let data = await QxRequest('post', url , params);
    try {
      result.rows = data.M.C.Res.Param.Preset
      result.code = data.M.C._SPError
    }catch(error) {
      result.msg = "fail"
    }
    return result
  },

  // 设置预置位
  setPresetPos: (params) => {
    return QxRequest('post',`${base_url}PTZ/C_PTZ_SetPresetPos`, params);
  },

  // 前往预置位
  moveToPresetPos: (params) => {
    return QxRequest('post',`${base_url}PTZ/C_PTZ_MoveToPresetPos`, params);
  },

  // 前往原始预置位
  gotoOriginalPresetPos: (params) => {
    return QxRequest('post',`${base_url}PTZ/C_PTZ_GotoOriginalPresetPos`, params);
  },


  // 开始云抓拍
  startCloudSnapshot: (params) => {
    return QxRequest('post',`${base_url}CSS/C_CSS_StartManualSnapshot`, params);
  },

  // 开始云存储(云连拍，云录像)
  startCloudStorage: (params) => {
    return QxRequest('post',`${base_url}CSS/C_CSS_StartManualStorage`, params);
  },

  // 停止云存储（云录像，云连拍）
  stopCloudStorage: (params) => {
    return QxRequest('post',`${base_url}CSS/C_CSS_StopManualStorage`, params);
  },

  // 开始前端抓拍
  startSGSnapshot: (params) => {
    return QxRequest('get',`${base_url}SG/C_SG_StartSnapshot`, params);
  },

  // 开始前端录像
  startSGStorage: (params) => {
    params.IVIdx = params.idx || '0'
    return QxRequest('get',`${base_url}SG/VODFile.flv`, params);
  },

  // 开始对讲
  startTalk: (params)=>{
    return QxRequest('get',`${base_url}audio/startTalk2`, params);
  },

  // 开始喊话
  startCall: (params)=>{
    return QxRequest('get',`${base_url}audio/startCall2`, params);
  },

  // 停止对讲、喊话、播放流
  stoptStream: (params)=>{
    return QxRequest('get',`${base_url}stopPlay2`, params);
  },

  // 伴音
  enablePlayAudio: (params)=>{
    return QxRequest('get',`${base_url}enablePlayAudio`, params);
  },

  // 本地抓拍
  startLocalSnap: (params) => {
    return QxRequest('get',`${base_url}localSnapshot2`, params);
  },
  // 本地连拍
  startLocalSnapShot:(params) => {
    return QxRequest('get',`${base_url}localSerialSnapshot2`, params);
  },
  // 停止本地连拍
  stopLocalSnapShot:(params) => {
    return QxRequest('get',`${base_url}cancelLocalSerialSnapshot2`, params);
  },
  // 本地录像
  startLocalVideo:(params) => {
    return QxRequest('get',`${base_url}localRecord2`, params);
  },
  // 停止本地录像
  stopLocalVideo:(params) => {
    return QxRequest('get',`${base_url}CancelLocalRecord2`, params);
  },

  /**
  * 
  * @param {*查询回放} params 
  * 
  */
  // 查询云文件（云录像，云抓拍）
  getCloudFile: (params) => {
    return QxRequest('get',`${base_url}CSS/C_CSS_QueryStorageFiles`, params);
  },

  // 查询前端文件（录像，抓拍，录音）
  getDeviceFile: (params) => {
    return QxRequest('get',`${base_url}SG/C_SG_QueryRecordFiles`, params);
  },

  // 下载云文件
  downloadCloudFile: (params) => {
    return QxRequest('get',`${base_url}downloadCloudFile2`, params);
  },

  // 下载前端文件
  downloadDeviceFile: (params) => {
    return QxRequest('get',`${base_url}downloadDeviceFile2`, params);
  },

  // 暂停下载
  setPuaseDownload: (params) => {
    return QxRequest('get',`${base_url}puaseDownload2`, params);
  },

  // 恢复下载
  setRestoreDownload: (params) => {
    return QxRequest('get',`${base_url}restoreDownload2`, params);
  },

  // 停止下载
  setStopDownload: (params) => {
    return QxRequest('get',`${base_url}stopDownload2`, params);
  },

  // 点播云文件
  getVodCloudFile: (params) => {
    return QxRequest('get',`${base_url}vodCloudFile2`, params);
  },

  // 点播前端文件
  getVodDeviceFile: (params) => {
    return QxRequest('get',`${base_url}vodDeviceFile2`, params);
  },

  // 暂停点播
  setPuaseVod: (params) => {
    return QxRequest('get',`${base_url}puaseVod2`, params);
  },

  // 恢复点播
  setRestoreVod: (params) => {
    return QxRequest('get',`${base_url}restoreVod2`, params);
  },

  // 设置点播速度
  setSpeedVod: (params) => {
    return QxRequest('get',`${base_url}setVodSpeed2`, params);
  },

  // 设置点播位置
  setOffsetVod: (params) => {
    return QxRequest('get',`${base_url}setVodOffset2`, params);
  },

  
  /**
  * 
  * @param {*电子地图} params 
  * 
  */

  // 订阅GPS信息
  subscriptionGps: (params) => {
    let token = params.token
    let epid = params.epid || '';
    let puid = params.puid || "";
    let idx = params.idx || 0;
    let xml = '<?xml version="1.0" encoding="UTF-8"?><M Type="ComReq"><C Type="C" EPID="'+epid+'"><Res Type="ST" Idx="'+idx+'" OptID="C_GS_SubscribeGPSData"><Param></Param></Res></C><OSets><Res OType="201" OID="'+puid+'" Type="GPS" Idx="'+idx+'"></Res></OSets></M>'
    let url = base_url+'RawRequest?dstType=33&token='+token;
    let params1 = { xml }
    return QxRequest('POST',url,params1)
  },

  // 查询设备最新GPS-当前定位
  getPuidLastGps: (params)=> {
    let token = params.token
    let puid = params.puid || [];
    let epid = params.epid || '';
    let Osets = "<OSets>";
    Osets += '<Res OType="201" OID="'+puid+'" Type="GPS" Idx="0"></Res>';
    Osets +=  "</OSets>";
    let xml = '<?xml version="1.0" encoding="UTF-8"?><M Type="ComReq"><C Type="C" EPID="'+epid+'"><Res Type="ST" Idx="0" OptID="C_GS_QueryLastGPSData"><Param></Param></Res></C>'+Osets+'</M>'
    let url = base_url+'RawRequest?dstType=33&dstID=""&token='+token;
    let params1 = { xml }
    return QxRequest('POST',url,params1)
  },

  // 查询历史GPS信息
  getPuidHistoryGps: (params) => {
    let token = params.token
    let offset = params.offset || 0;
    let count = params.count || 100;
    let begin = params.begin ;
    let end = params.end ;
    let puid = params.puid ;
    let epid = params.epid || '';
    let Osets = "<OSets>";
    Osets += '<Res OType="201" OID="'+puid+'" Type="ST" Idx="0"></Res>';
    Osets +=  "</OSets>";
    let xml = '<?xml version="1.0" encoding="UTF-8"?><M Type="ComReq"><C Type="C" EPID="'+epid+'"><Res Type="ST" Idx="0" OptID="C_GS_QueryHistoryGPSData"><Param  Offset="'+offset+'" Count="'+count+'" Begin="'+begin+'" End="'+end+'"></Param></Res></C>'+Osets+'</M>'
    let url = base_url+'RawRequest?dstType=33&dstID=""&token='+token;
    let params1 = { xml }
    return QxRequest('POST',url,params1)
  }
};
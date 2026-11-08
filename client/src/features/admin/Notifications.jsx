import { useState } from 'react';
import { api } from '../../services/api.js';
import SimpleData from '../dashboard/SimpleData.jsx';
import { Notice } from '../../components/ui/index.js';

export default function Notifications({token,tick,refresh}){const[err,setErr]=useState('');return <><Notice message={err}/><SimpleData path="/notifications" token={token} tick={tick} render={n=><div className="flex-between"><div><h3>{n.title}</h3><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()}</small></div>{!n.readAt&&<button className="outline-btn" onClick={async()=>{try{await api(`/notifications/${n._id}/read`,{method:'PATCH',token});refresh()}catch(e){setErr(e.message)}}}>Mark read</button>}</div>}/></>}

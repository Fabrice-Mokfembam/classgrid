import type { Assignment, Lesson, SchoolClass, Subject, Teacher } from "./types";
export const teachers:Teacher[]=[
 {id:"t1",name:"Daniel Nfor",code:"T-001",subjects:["Mathematics","Physics"],phone:"+237 677 000 101",email:"daniel@school.cm",required:18,available:28,status:"Active"},
 {id:"t2",name:"Alice Awa",code:"T-002",subjects:["English"],required:16,available:32,status:"Active"},
 {id:"t3",name:"Emmanuel Tabi",code:"T-003",subjects:["Physics","Science"],required:20,available:25,status:"Active"},
 {id:"t4",name:"Marie Ewane",code:"T-004",subjects:["Computer Science"],required:14,available:24,status:"Active"},
];
export const classes:SchoolClass[]=[{id:"c1",name:"Form 1A",level:"Form 1",students:42,assignments:12},{id:"c2",name:"Form 1B",level:"Form 1",students:38,assignments:11},{id:"c3",name:"Form 2A",level:"Form 2",students:40,assignments:13},{id:"c4",name:"Form 3B",level:"Form 3",students:36,assignments:12}];
export const subjects:Subject[]=[{id:"s1",name:"Mathematics",code:"MATH",color:"#3b82f6",active:true},{id:"s2",name:"English Language",code:"ENG",color:"#8b5cf6",active:true},{id:"s3",name:"Physics",code:"PHY",color:"#22a06b",active:true},{id:"s4",name:"French",code:"FRE",color:"#f97362",active:true},{id:"s5",name:"Computer Science",code:"ICT",color:"#a855f7",active:true}];
export const assignments:Assignment[]=[{id:"a1",teacher:"Daniel Nfor",subject:"Mathematics",className:"Form 2A",periods:5,pattern:"Singles"},{id:"a2",teacher:"Emmanuel Tabi",subject:"Physics",className:"Form 2A",periods:4,pattern:"Mixed"},{id:"a3",teacher:"Alice Awa",subject:"English Language",className:"Form 2A",periods:5,pattern:"Singles"},{id:"a4",teacher:"Marie Ewane",subject:"Computer Science",className:"Form 2A",periods:2,pattern:"Double"}];
const names=[{subject:"Mathematics",teacher:"Daniel Nfor",color:"blue"},{subject:"English",teacher:"Alice Awa",color:"purple"},{subject:"Physics",teacher:"Emmanuel Tabi",color:"green"},{subject:"French",teacher:"Jean Mbarga",color:"coral"},{subject:"Computer Science",teacher:"Marie Ewane",color:"violet"}];
export const lessons:Lesson[]=["Monday","Tuesday","Wednesday","Thursday","Friday"].flatMap((day,d)=>[1,2,3,4,5,6,7,8].map((period,p)=>{const n=names[(d+p)%names.length];return {id:`${d}-${p}`,day,period,subject:n.subject,teacher:n.teacher,className:"Form 2A",color:n.color,locked:(d+p)%4===0}}));
export const days=["Monday","Tuesday","Wednesday","Thursday","Friday"];
export const periods=[{n:1,time:"07:45 – 08:30"},{n:2,time:"08:30 – 09:15"},{n:3,time:"09:30 – 10:15"},{n:4,time:"10:15 – 11:00"},{n:5,time:"11:30 – 12:15"},{n:6,time:"12:15 – 13:00"},{n:7,time:"13:00 – 13:45"},{n:8,time:"13:45 – 14:30"}];

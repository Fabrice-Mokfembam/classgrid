export type SetupStep = "school"|"year"|"schedule"|"levels"|"subjects"|"teachers"|"assignments";
export type Teacher = { id:string; name:string; code:string; subjects:string[]; phone?:string; email?:string; required:number; available:number; status:"Active"|"Inactive" };
export type SchoolClass = { id:string; name:string; level:string; students?:number; assignments:number };
export type Subject = { id:string; name:string; code:string; color:string; active:boolean };
export type Assignment = { id:string; teacher:string; subject:string; className:string; periods:number; pattern:"Singles"|"Double"|"Mixed" };
export type Lesson = { id:string; day:string; period:number; subject:string; teacher:string; className:string; color:string; locked:boolean };
export type SchoolProfile = { name:string; legalName:string; type:string; country:string; region:string; city:string; address:string; phone:string; email:string; website:string; timezone:string; curriculum:string; levels:string[]; studentCount:string; adminName:string; adminRole:string; adminEmail:string; adminPhone:string; academicYear:string; teachingDays:string };

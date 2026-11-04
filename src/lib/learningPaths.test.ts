import { describe,it,expect } from 'vitest';
import { pathProgress, validatePath, sequentialUnlocked, filterPathStudents, studentsCsv, validatePathCover } from './learningPaths';
const courses = [{track_id:'1',category:'RH',position:0,completed:true},{track_id:'2',category:'RH',position:1,completed:false}];
const valid = {name:'RH',description:'Descrição',status:'published',categories:['RH'],courses};
describe('trilhas de aprendizagem',()=>{
  it('exige nome não vazio',()=>expect(validatePath({...valid,name:'   '}).name).toBeTruthy());
  it('exige descrição não vazia',()=>expect(validatePath({...valid,description:'   '}).description).toBeTruthy());
  it('não publica sem cursos',()=>expect(validatePath({...valid,courses:[]}).courses).toBeTruthy());
  it('permite rascunho sem cursos',()=>expect(validatePath({...valid,status:'draft',courses:[]})).toEqual({}));
  it('não repete curso',()=>expect(validatePath({...valid,courses:[courses[0],courses[0]]}).courses).toBeTruthy());
  it('calcula pela quantidade de cursos',()=>expect(pathProgress(courses).percent).toBe(50));
  it('reaproveita curso concluído',()=>expect(pathProgress([courses[0]]).status).toBe('Concluída'));
  it('bloqueia curso anterior pendente',()=>expect(sequentialUnlocked([{...courses[0],completed:false},courses[1]],1)).toBe(false));
  it('libera curso após concluir anterior',()=>expect(sequentialUnlocked(courses,1)).toBe(true));
  it('CSV respeita empresa e busca',()=>{ const rows = filterPathStudents([{user_id:'a',name:'Ana',email:'ana@example.test',companies:[{id:'rh',name:'RH'}],completed_courses:['1'],started:true},{user_id:'b',name:'Bia',email:'bia@example.test',companies:[{id:'time',name:'Time'}],completed_courses:[],started:false}],courses,'ana','rh','Em andamento'); expect(rows).toHaveLength(1); expect(studentsCsv(rows)).not.toContain('Bia'); });
  it('aceita capa de 5MB',()=>expect(validatePathCover({type:'image/jpeg',size:5*1024*1024})).toBeNull());
  it('rejeita capa acima de 5MB',()=>expect(validatePathCover({type:'image/png',size:5*1024*1024+1})).toBeTruthy());
});
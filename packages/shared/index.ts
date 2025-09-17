export type AgentMovie = {
    id:number; reason:string; why_for_user?:string;
  };
  export type AgentResponse = {
    summary:string; movies: AgentMovie[];
  };
  
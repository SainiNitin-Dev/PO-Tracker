import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({requireApiUser:vi.fn(), providerRequest:vi.fn(), providerConfig:vi.fn(), rpc:vi.fn(), previous:vi.fn(), insert:vi.fn()}));
vi.mock("@/lib/user", () => ({requireApiUser:mocks.requireApiUser}));
vi.mock("@/lib/coach/provider", async importOriginal => ({...await importOriginal<object>(), providerConfig:mocks.providerConfig, providerRequest:mocks.providerRequest}));
import { POST } from "./route";
const older = {id:"00000000-0000-0000-0000-000000000001",storage_path:"owner/a.jpg",taken_at:"2026-01-01",pose:"front",conditions:null};
const newer = {...older,id:"00000000-0000-0000-0000-000000000002",storage_path:"owner/b.jpg",taken_at:"2026-02-01"};
const context = {older:{id:older.id,storagePath:older.storage_path,date:older.taken_at,pose:older.pose,notes:null},newer:{id:newer.id,storagePath:newer.storage_path,date:newer.taken_at,pose:newer.pose,notes:null}};
const request = () => new Request("https://app.example/api/photo-reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({olderPhotoId:older.id,newerPhotoId:newer.id})});
beforeEach(() => {
  vi.clearAllMocks();
  const reviews = {select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:mocks.previous,insert:mocks.insert};
  for (const name of ["select","eq","order","limit"] as const) reviews[name].mockReturnValue(reviews);
  mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:"new-review"},error:null})})});
  mocks.rpc.mockResolvedValue({data:[{allowed:true}],error:null});
  mocks.providerRequest.mockResolvedValue(JSON.stringify({review:"The lighting differs, so visible changes are uncertain.",confidence:"low",comparable:false}));
  mocks.previous.mockResolvedValue({data:{id:"old-review",review_text:"Earlier comparison.",confidence:"low",source_context:context},error:null});
  mocks.requireApiUser.mockResolvedValue({user:{id:"owner"},supabase:{from:(table:string)=>table==="progress_photos"?{select:()=>({in:()=>({eq:async()=>({data:[older,newer],error:null})})})}:reviews,rpc:mocks.rpc,storage:{from:()=>({createSignedUrls:async()=>({data:[{signedUrl:"https://example.test/old"},{signedUrl:"https://example.test/new"}],error:null})})}}});
});
describe("photo comparison reuse",()=>{
  it("reuses unchanged inputs without spending another AI request",async()=>{
    const response=await POST(request());
    expect(response.status).toBe(200); expect((await response.json()).id).toBe("old-review");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.providerRequest).not.toHaveBeenCalled();
  });
  it("generates a new review when the stored metadata differs",async()=>{
    mocks.previous.mockResolvedValue({data:{id:"old-review",source_context:{...context,newer:{...context.newer,notes:"Different conditions"}}},error:null});
    expect((await POST(request())).status).toBe(200);
    expect(mocks.providerRequest).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({user_id:"owner",source_context:context}));
  });
  it("keeps old reviews and requests a new one when no input snapshot exists",async()=>{
    mocks.previous.mockResolvedValue({data:{id:"legacy",source_context:null},error:null});
    expect((await POST(request())).status).toBe(200); expect(mocks.insert).toHaveBeenCalledOnce();
  });
});

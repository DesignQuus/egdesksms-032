import { getCurrentUser } from '@/lib/auth';
import { LogOut } from 'lucide-react';
import SidebarMenu from './SidebarMenu';

export default async function Sidebar() {
  
  let userName = '운영자';
  let userRole = 'SUB_OPERATOR';

  const user = await getCurrentUser();
  if (user?.name) userName = user.name;
  if (user?.role) userRole = user.role;


  return (
    <div className="w-64 bg-slate-900 text-white h-full min-h-0 flex flex-col shadow-2xl">
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}} />
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
          EGDESK SMS
        </h1>
        <p className="text-sm text-slate-400 mt-1">평생 무료 문자 발송 시스템</p>
      </div>
      
      <SidebarMenu userRole={userRole} />

      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
            {userName[0] || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-200 leading-tight">{userName}</span>
            <span className="text-[10px] text-slate-500 leading-tight">{userRole === 'SUPER_ADMIN' ? '최고관리자' : '부운영자'}</span>
          </div>
        </div>
        <form action={async () => {
          "use server";
          const { cookies } = await import("next/headers");
          const cookieStore = await cookies();
          // DB 세션을 지워 즉시 무효화한 뒤 쿠키 삭제
          const { revokeSession } = await import("@/lib/security/session");
          const { SESSION_COOKIE, CSRF_COOKIE, LEGACY_JWT_COOKIE } = await import("@/lib/security/core");
          await revokeSession(cookieStore.get(SESSION_COOKIE)?.value).catch(() => undefined);
          for (const name of [SESSION_COOKIE, CSRF_COOKIE, LEGACY_JWT_COOKIE]) cookieStore.delete(name);
          const { redirect } = await import("next/navigation");
          redirect('/login');
        }}>
          <button type="submit" className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="로그아웃">
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

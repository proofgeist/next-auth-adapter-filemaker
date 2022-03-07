import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { signIn, signOut, useSession } from "next-auth/react";
/* This example requires Tailwind CSS v2.0+ */
const navigation = [
    { name: "Solutions", href: "#" },
    { name: "Pricing", href: "#" },
    { name: "Docs", href: "#" },
    { name: "Company", href: "#" },
];
export default function Header() {
    var _a;
    const { data: session, status } = useSession();
    console.log(session);
    if (status === "loading")
        return _jsx(_Fragment, {}, void 0);
    return (_jsx("header", Object.assign({ className: "bg-primary-600" }, { children: _jsxs("nav", Object.assign({ className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", "aria-label": "Top" }, { children: [_jsxs("div", Object.assign({ className: "w-full py-6 flex items-center justify-between border-b border-primary-500 lg:border-none" }, { children: [_jsxs("div", Object.assign({ className: "flex items-center" }, { children: [_jsxs("a", Object.assign({ href: "#", className: "text-white" }, { children: [_jsx("span", Object.assign({ className: "sr-only" }, { children: "Workflow" }), void 0), _jsx("img", { className: "h-10 w-auto", src: "/logo.svg", alt: "" }, void 0)] }), void 0), _jsx("div", Object.assign({ className: "hidden ml-10 space-x-8 lg:block" }, { children: navigation.map((link) => (_jsx("a", Object.assign({ href: link.href, className: "text-base font-medium text-white hover:text-primary-50" }, { children: link.name }), link.name))) }), void 0)] }), void 0), session ? (_jsxs("div", Object.assign({ className: "ml-10 space-x-4 text-white flex items-center" }, { children: [_jsxs("p", Object.assign({ className: "text-white" }, { children: ["Welcome ", session.user.name] }), void 0), ((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.image) && (
                                // eslint-disable-next-line @next/next/no-img-element
                                _jsx("img", { className: "inline-block h-10 w-10 rounded-full", src: session.user.image, alt: "Profile photo" }, void 0)), _jsx("a", Object.assign({ onClick: () => signOut({ redirect: false }), className: "inline-block bg-white py-2 px-4 border border-transparent rounded-md text-base font-medium text-primary-600 hover:bg-primary-50" }, { children: "Logout" }), void 0)] }), void 0)) : (_jsxs("div", Object.assign({ className: "ml-10 space-x-4" }, { children: [_jsx("a", Object.assign({ onClick: () => signIn(), className: "inline-block bg-primary-500 py-2 px-4 border border-transparent rounded-md text-base font-medium text-white hover:bg-opacity-75" }, { children: "Sign in" }), void 0), _jsx("a", Object.assign({ onClick: () => signIn(), className: "inline-block bg-white py-2 px-4 border border-transparent rounded-md text-base font-medium text-primary-600 hover:bg-primary-50" }, { children: "Sign up" }), void 0)] }), void 0))] }), void 0), _jsx("div", Object.assign({ className: "py-4 flex flex-wrap justify-center space-x-6 lg:hidden" }, { children: navigation.map((link) => (_jsx("a", Object.assign({ href: link.href, className: "text-base font-medium text-white hover:text-primary-50" }, { children: link.name }), link.name))) }), void 0)] }), void 0) }), void 0));
}

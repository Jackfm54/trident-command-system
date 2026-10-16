import { t, translateText, locale, useLanguage } from "@/lib/i18n";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  useLanguage();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
       {t("")} <div className="text-center">
         {t("")} <h1 className="mb-4 text-4xl font-bold">404</h1>
         {t("")} <p className="mb-4 text-xl text-muted-foreground">{t("Oops! Page not found")}</p>
         {t("")} <a href="/" className="text-primary underline hover:text-primary/90">
           {t("Return to Home")} </a>
       {t("")} </div>
     {t("")} </div>
  );
};

export default NotFound;

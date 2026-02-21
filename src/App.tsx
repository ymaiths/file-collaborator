import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import CreateQuotation from "./pages/CreateQuotation";
import NotFound from "./pages/NotFound"; 
import ManageUsers from "./pages/ManageUsers";
import Login from "./pages/Login";
import { ProtectedRoute } from "./components/ProtectedRoute"; 

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* หน้า Login ปล่อยให้ทุกคนเข้าได้ */}
          <Route path="/login" element={<Login />} />
          
          {/* 👇 โซนนี้คือหน้าเว็บที่ถูกล็อกไว้ ต้องผ่าน ProtectedRoute ก่อน */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Index />} />
            <Route path="/quotation/new" element={<CreateQuotation />} />
            <Route path="/quotation/:id" element={<CreateQuotation />} />
            <Route path="/admin/users" element={<ManageUsers />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

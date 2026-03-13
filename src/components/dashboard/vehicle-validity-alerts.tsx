
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { AlertTriangle, Calendar, ShieldCheck, FileText, ReceiptText, Zap } from 'lucide-react';
import { format, isSameMonth, parseISO, isBefore, startOfToday } from 'date-fns';

interface Vehicle {
  id: string;
  regNumber: string;
  type: string;
  brandModel: string;
  regValidity: string;
  insuranceValidity: string;
  taxValidity: string;
  puccValidity: string;
  status: string;
}

export default function VehicleValidityAlerts() {
  const db = useFirestore();
  const { user } = useUser();

  const vehiclesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'vehicles');
  }, [db, user]);

  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesQuery);

  const expiringAlerts = useMemo(() => {
    if (!vehicles) return [];
    const today = startOfToday();

    return vehicles.map(v => {
      const regDate = v.regValidity ? parseISO(v.regValidity) : null;
      const insDate = v.insuranceValidity ? parseISO(v.insuranceValidity) : null;
      const taxDate = v.taxValidity ? parseISO(v.taxValidity) : null;
      const puccDate = v.puccValidity ? parseISO(v.puccValidity) : null;

      const isRegAlert = regDate ? (isSameMonth(regDate, today) || isBefore(regDate, today)) : false;
      const isInsAlert = insDate ? (isSameMonth(insDate, today) || isBefore(insDate, today)) : false;
      const isTaxAlert = taxDate ? (isSameMonth(taxDate, today) || isBefore(taxDate, today)) : false;
      const isPuccAlert = puccDate ? (isSameMonth(puccDate, today) || isBefore(puccDate, today)) : false;

      if (!isRegAlert && !isInsAlert && !isTaxAlert && !isPuccAlert) return null;

      return {
        ...v,
        regAlert: isRegAlert,
        insAlert: isInsAlert,
        taxAlert: isTaxAlert,
        puccAlert: isPuccAlert,
        isExpired: (regDate && isBefore(regDate, today)) || 
                   (insDate && isBefore(insDate, today)) || 
                   (taxDate && isBefore(taxDate, today)) || 
                   (puccDate && isBefore(puccDate, today))
      };
    }).filter(v => v !== null);
  }, [vehicles]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="h-6 w-32 animate-pulse bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-12 w-full animate-pulse bg-muted rounded" />
            <div className="h-12 w-full animate-pulse bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 dark:border-orange-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-5 w-5" />
          Validity Alerts
        </CardTitle>
        <CardDescription>
          Documents expiring or expired this month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {expiringAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No vehicles require document updates this month.</p>
            </div>
          ) : (
            expiringAlerts.map((v) => (
              <div key={v.id} className={`flex flex-col gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors ${v.isExpired ? 'border-red-200 bg-red-50/10' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{v.regNumber}</span>
                    {v.isExpired && <Badge variant="destructive" className="text-[8px] h-4">EXPIRED</Badge>}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">{v.brandModel}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-1">
                  {v.regAlert && (
                    <div className="flex items-center gap-2 text-[11px] font-medium text-orange-600 dark:text-orange-400">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Reg: {v.regValidity ? format(parseISO(v.regValidity), 'MMM dd') : 'N/A'}</span>
                    </div>
                  )}
                  {v.insAlert && (
                    <div className="flex items-center gap-2 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Ins: {v.insuranceValidity ? format(parseISO(v.insuranceValidity), 'MMM dd') : 'N/A'}</span>
                    </div>
                  )}
                  {v.taxAlert && (
                    <div className="flex items-center gap-2 text-[11px] font-medium text-purple-600">
                      <ReceiptText className="h-3.5 w-3.5" />
                      <span>Tax: {v.taxValidity ? format(parseISO(v.taxValidity), 'MMM dd') : 'N/A'}</span>
                    </div>
                  )}
                  {v.puccAlert && (
                    <div className="flex items-center gap-2 text-[11px] font-medium text-green-600">
                      <Zap className="h-3.5 w-3.5" />
                      <span>PUCC: {v.puccValidity ? format(parseISO(v.puccValidity), 'MMM dd') : 'N/A'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

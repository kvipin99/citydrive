
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { Car, CheckCircle2, AlertCircle, Wrench, RefreshCw } from "lucide-react";

export default function FleetStatus() {
  const db = useFirestore();
  const { user } = useUser();

  const vehiclesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'vehicles');
  }, [db, user]);

  const { data: vehicles, isLoading } = useCollection(vehiclesQuery);

  return (
    <Card className="shadow-sm border-primary/10 overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5 text-primary" />
            Fleet Status
          </CardTitle>
          {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>Real-time availability of training vehicles.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isLoading ? (
            [1, 2, 3, 4].map(i => <div key={i} className="h-14 w-full animate-pulse bg-muted rounded-xl" />)
          ) : vehicles?.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground border-2 border-dashed rounded-xl">
              <Car className="h-10 w-10 opacity-10 mb-2" />
              <p className="text-sm italic">No vehicles registered in fleet.</p>
            </div>
          ) : (
            vehicles?.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:shadow-sm transition-all group border-primary/5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Car className="h-4 w-4 text-primary" />
                  </div>
                  <div className="grid">
                    <span className="font-bold text-sm tracking-tight leading-none mb-1">{v.regNumber}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold truncate max-w-[120px]">
                      {v.brandModel}
                    </span>
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'Available':
      return (
        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 gap-1 text-[10px] font-bold px-2 py-0.5">
          <CheckCircle2 className="h-3 w-3" /> READY
        </Badge>
      );
    case 'Maintenance':
      return (
        <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200 gap-1 text-[10px] font-bold px-2 py-0.5">
          <Wrench className="h-3 w-3" /> SHOP
        </Badge>
      );
    case 'In Use':
      return (
        <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 gap-1 text-[10px] font-bold px-2 py-0.5">
          <AlertCircle className="h-3 w-3" /> BUSY
        </Badge>
      );
    default:
      return <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{status}</Badge>;
  }
}

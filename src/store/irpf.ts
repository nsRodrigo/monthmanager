import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import {
  classifyDescription,
  parseAnyFile,
  type IrpfCategory,
  type IrpfDocument,
  type IrpfEntry,
  type IrpfYearSnapshot,
} from "@/lib/irpf";

const BUCKET = "irpf-docs";

function mapDocument(r: any): IrpfDocument {
  return {
    id: r.id,
    year: r.year,
    kind: r.kind,
    filePath: r.file_path,
    originalName: r.original_name,
    mime: r.mime,
    size: r.size,
    uploadedAt: r.uploaded_at,
  };
}

function mapEntry(r: any): IrpfEntry {
  return {
    id: r.id,
    documentId: r.document_id,
    date: r.date,
    description: r.description,
    amount: Number(r.amount) || 0,
    source: r.source,
    category: r.category as IrpfCategory,
    subcategory: r.subcategory,
    year: r.year,
  };
}

function mapSnapshot(r: any): IrpfYearSnapshot {
  return {
    id: r.id,
    year: r.year,
    accountId: r.account_id,
    investmentId: r.investment_id,
    label: r.label,
    value: Number(r.value) || 0,
  };
}

export function useIrpfDocuments(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["irpf_documents", user?.id, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_documents")
        .select("*")
        .eq("year", year)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDocument);
    },
  });
}

export function useIrpfEntries(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["irpf_entries", user?.id, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_entries")
        .select("*")
        .eq("year", year)
        .order("date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(mapEntry);
    },
  });
}

export function useIrpfSnapshots(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["irpf_snapshots", user?.id, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_year_snapshots")
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return (data ?? []).map(mapSnapshot);
    },
  });
}

export function useUploadIrpfDoc(year: number) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: string }) => {
      if (!user) throw new Error("not authenticated");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${year}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: docRow, error: docErr } = await supabase
        .from("irpf_documents")
        .insert({
          user_id: user.id,
          year,
          kind,
          file_path: path,
          original_name: file.name,
          mime: file.type || null,
          size: file.size,
        })
        .select("*")
        .single();
      if (docErr) throw docErr;

      // Parse and classify (client-side)
      let parsedRows: Awaited<ReturnType<typeof parseAnyFile>> = [];
      try {
        parsedRows = await parseAnyFile(file);
      } catch (e) {
        console.warn("[irpf] parse falhou", e);
      }

      if (parsedRows.length > 0) {
        const entries = parsedRows.map((r) => {
          const cls = classifyDescription(r.description);
          return {
            user_id: user!.id,
            document_id: docRow.id,
            date: r.date,
            description: r.description.slice(0, 500),
            amount: r.amount,
            source: file.name.slice(0, 200),
            category: cls.category,
            subcategory: cls.subcategory,
            year,
          };
        });
        // chunk insert
        for (let i = 0; i < entries.length; i += 500) {
          const chunk = entries.slice(i, i + 500);
          const { error } = await supabase.from("irpf_entries").insert(chunk);
          if (error) throw error;
        }
      }

      return { document: mapDocument(docRow), entriesCount: parsedRows.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irpf_documents"] });
      qc.invalidateQueries({ queryKey: ["irpf_entries"] });
    },
  });
}

export function useDeleteIrpfDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: IrpfDocument) => {
      // remove storage object (best-effort)
      await supabase.storage.from(BUCKET).remove([doc.filePath]).catch(() => {});
      const { error } = await supabase.from("irpf_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irpf_documents"] });
      qc.invalidateQueries({ queryKey: ["irpf_entries"] });
    },
  });
}

export function useReclassifyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category, subcategory }: { id: string; category: IrpfCategory; subcategory?: string | null }) => {
      const { error } = await supabase
        .from("irpf_entries")
        .update({ category, subcategory: subcategory ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, category, subcategory }) => {
      await qc.cancelQueries({ queryKey: ["irpf_entries"] });
      const prev = qc.getQueriesData<IrpfEntry[]>({ queryKey: ["irpf_entries"] });
      qc.setQueriesData<IrpfEntry[]>({ queryKey: ["irpf_entries"] }, (old) =>
        old ? old.map((e) => (e.id === id ? { ...e, category, subcategory: subcategory ?? null } : e)) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["irpf_entries"] }),
  });
}

export function useUpsertSnapshot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snap: Omit<IrpfYearSnapshot, "id"> & { id?: string }) => {
      if (!user) throw new Error("not authenticated");
      if (snap.id) {
        const { error } = await supabase
          .from("irpf_year_snapshots")
          .update({ value: snap.value, label: snap.label })
          .eq("id", snap.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("irpf_year_snapshots").insert({
          user_id: user.id,
          year: snap.year,
          account_id: snap.accountId,
          investment_id: snap.investmentId,
          label: snap.label,
          value: snap.value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["irpf_snapshots"] }),
  });
}

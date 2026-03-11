export namespace main {
	
	export class DocumentPayload {
	    name: string;
	    path: string;
	    content: string;
	    cancelled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DocumentPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.content = source["content"];
	        this.cancelled = source["cancelled"];
	    }
	}

}

